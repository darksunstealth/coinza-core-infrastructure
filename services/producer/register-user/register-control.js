import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { check, validationResult } from 'express-validator';
import crypto from 'crypto';
import WalletService from './utils/wallet-service.js';
import KafkaBatchPublisher from './kafka/kafka-publishers.js'; // importe a classe criada

const secretKey = process.env.JWT_SECRET;

class registerController {
  constructor(app, emailService, cacheManager, logger, kafkaService) {
    this.emailService = emailService;
    this.cacheManager = cacheManager;
    this.logger = logger;
    this.walletService = new WalletService(this.cacheManager, this.logger);
    this.kafkaService = kafkaService;

    // Inicializamos o publicador de batch para um tópico específico.
    // Os parâmetros podem ser ajustados conforme sua necessidade.
    this.kafkaBatchPublisher = new KafkaBatchPublisher(this.kafkaService, 'register-api-1', {
      maxBufferSize: 50,
      flushInterval: 2000,       // flush a cada 2 segundos
      backpressureLimit: 100,
    });

    this.registerUser = this.registerUser.bind(this);
    this.changePassword = this.changePassword.bind(this);
    this.confirmEmail = this.confirmEmail.bind(this);

    if (app) {
      this.setupRoutes(app);
    }
  }

  get validateRegister() {
    return [
      check('email')
        .isEmail()
        .withMessage('Deve ser um endereço de email válido.'),
      check('password')
        .isLength({ min: 6 })
        .withMessage('A senha deve ter pelo menos 6 caracteres.'),
      // Adicione outras validações conforme necessário
      (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        next();
      },
    ];
  }

  async registerUser(req, res) {
    this.logger.info('Iniciando processo de registro de usuário');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      this.logger.warn('Validação falhou:', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    // Extraímos os dados do body, incluindo o referralCode, se houver.
    let { email, password, terms, referralCode } = req.body;
    email = email.toLowerCase();
    this.logger.info('Dados recebidos:', { email });

    if (!terms) {
      this.logger.warn('Termos de uso não foram aceitos.');
      return res.status(400).json({
        message: 'Você deve concordar com os termos de uso para criar uma conta.',
      });
    }

    try {
      const usersKey = 'USERS';
      let users = await this.cacheManager.get(usersKey);
      if (users) {
        try {
          users = JSON.parse(users);
        } catch (parseError) {
          this.logger.error('Erro ao fazer parse de USERS no cache', parseError);
          return res.status(500).json({ message: 'Erro interno do servidor.' });
        }
      } else {
        users = [];
      }

      const userExists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
      if (userExists) {
        this.logger.warn('Usuário já registrado:', { email });
        return res.status(400).json({ message: 'Usuário já registrado, tente outro e-mail.' });
      }

      const userId = uuidv4();
      const hashedPassword = await argon2.hash(password);
      this.logger.info('Senha criptografada (argon2) gerada com sucesso.');

      // Geramos um código para indicação do novo usuário. Esse código poderá ser usado por outros.
      const myReferralCode = crypto.randomBytes(4).toString('hex');

      // Exemplo de dados adicionais para o usuário.
      const p2pName = `${email.split('@')[0]}_${crypto.randomBytes(4).toString('hex')}`;
      const deviceInfo = req.headers['user-agent'] || 'Unknown';
      const ipAddress = req.ip || req.connection?.remoteAddress || 'Unknown';

      // Definimos o código de confirmação e seu tempo de expiração.
      const confirmationCode = crypto.randomBytes(16).toString('hex');
      const confirmationCodeExpires = Date.now() + 3600000; // 1 hora

      // Montamos o objeto de dados do usuário.
      // Se um referralCode foi informado, armazenamos em "referralCodeUsed".
      const userData = {
        userId,
        email,
        password: hashedPassword,
        confirmationCode,
        confirmationCodeExpires,
        verificada: false,
        P2PName: p2pName,
        deviceInfo,
        ipAddress,
        referralCode: myReferralCode, // código que o novo usuário poderá indicar
        ...(referralCode ? { referralCodeUsed: referralCode } : {}), // código de indicação utilizado, se houver
      };

      const userCacheKey = `USER:${email}`;
      await this.cacheManager.set(userCacheKey, JSON.stringify(userData), 3600); // TTL de 1 hora

      users.push({ userId, email });
      await this.cacheManager.set(usersKey, JSON.stringify(users), 36000000);

      // Se houver um código de indicação, você pode processá-lo.
      // Por exemplo, creditar um bônus ao usuário que indicou.
      if (referralCode) {
        try {
          // Exemplo: método que credita bônus ao usuário que fez a indicação.
          // Certifique-se de que o método "creditReferralBonus" exista em "walletService".
          await this.walletService.creditReferralBonus(referralCode, userId);
          this.logger.info('Bônus de indicação creditado para o referralCode:', referralCode);
        } catch (bonusError) {
          this.logger.error('Erro ao creditar bônus de indicação:', bonusError);
          // Aqui você pode optar por continuar ou tratar o erro conforme sua lógica de negócio.
        }
      }

      const orderPayload = {
        ...userData,               // Todos os dados do usuário
        action: 'REGISTER',        // Ação que identifica o tipo de registro
        timestamp: new Date().toISOString(),
      };

      try {
        // Adiciona a mensagem ao buffer do Kafka.
        this.kafkaBatchPublisher.addMessage({ value: JSON.stringify(orderPayload) });
        this.logger.info('Mensagem adicionada ao buffer para envio ao Kafka', orderPayload);
      } catch (bufferError) {
        this.logger.error('Backpressure: não foi possível adicionar a mensagem ao buffer', bufferError);
        // Você pode decidir como tratar esse cenário:
        // - Rejeitar a operação de registro;
        // - Ou registrar e continuar, deixando a mensagem ser descartada.
      }

      res.status(200).json({
        message: 'Register ok! Welcome!',
        userId,
      });
    } catch (error) {
      this.logger.error('Erro ao processar registro de usuário:', error);
      res.status(500).json({ message: 'Erro interno do servidor.' });
    }
  }
   async processQueue(userData, email) {
    const queueName = 'register_user_queue';
    const messageObj = {
      action: 'register',
      data: userData,
    };

    try {
      await this.amqpManager.sendToQueue(queueName, messageObj);
      this.logger.info(
        `Mensagem enviada para a fila '${queueName}' com sucesso para o usuário: ${email}`,
      );
      return { success : true };
    } catch (error) {
      this.logger.error(
        `Erro ao enviar mensagem para a fila '${queueName}':`,
        error,
      );
      return {
        success: false,
        message: 'Erro ao processar o registro do usuário.',
      };
    }
  }

  async processEmail(email, confirmationCode) {
    try {
      await this.emailService.enqueueEmail(
        email,
        'Confirmação de Registro',
        'confirmation_code', // Template de e-mail específico para código de confirmação
        {
          email,
          confirmationCode, // Passar o código para o template
        },
      );
      this.logger.info(`E-mail de confirmação enviado para: ${email}`);
      return { success: true };
    } catch (error) {
      this.logger.error('Erro ao enfileirar e-mail de confirmação:', error);
      return {
        success: false,
        message: 'Erro ao enviar e-mail de confirmação.',
      };
    }
  }

 
  async confirmEmail(req, res) {
    const { email, code } = req.body;
    this.logger.info('[CONFIRM MAIL] Requisição recebida para confirmação de e-mail.');
  
    if (!email || !code) {
      this.logger.warn('[CONFIRM MAIL] E-mail ou código de confirmação ausente na requisição.', { email, code });
      return res
        .status(400)
        .json({ message: 'E-mail e código de confirmação são obrigatórios.' });
    }
  
    try {
      // Converter o e-mail para minúsculas para manter consistência
      const normalizedEmail = email.toLowerCase();
      this.logger.debug('[CONFIRM MAIL] E-mail normalizado para busca no cache.', { normalizedEmail });
  
      // Montar a chave do cache baseada no e-mail
      const userCacheKey = `USER_DATA_${normalizedEmail}`;
      this.logger.debug('[CONFIRM MAIL] Chave do cache definida.', { userCacheKey });
  
      // Buscar os dados do usuário no Redis
      const cachedUserData = await this.redisCacheManager.get(userCacheKey);
      this.logger.debug('[CONFIRM MAIL] Dados do usuário recuperados do cache.', { cachedUserData });
  
      if (!cachedUserData) {
        this.logger.error('[CONFIRM MAIL] Dados do usuário não encontrados no cache.', { userCacheKey });
        return res
          .status(400)
          .json({ message: 'Dados do usuário não encontrados no cache.' });
      }
  
      // Converter os dados do cache para objeto (se necessário)
      let user;
      if (typeof cachedUserData === 'string') {
        try {
          user = JSON.parse(cachedUserData);
          this.logger.debug('[CONFIRM MAIL] Dados do usuário convertidos de string para objeto.', { user });
        } catch (parseError) {
          this.logger.error('[CONFIRM MAIL] Erro ao fazer parse de USER_DATA para o e-mail.', {
            normalizedEmail,
            errorMessage: parseError.message,
            errorStack: parseError.stack,
          });
          return res
            .status(500)
            .json({ message: 'Erro interno ao processar os dados do usuário.' });
        }
      } else {
        user = cachedUserData;
        this.logger.debug('[CONFIRM MAIL] Dados do usuário já estão no formato de objeto.', { user });
      }
  
      // Verificar se o e-mail já foi confirmado
      if (user.verificada) {
        this.logger.info('[CONFIRM MAIL] E-mail já confirmado anteriormente.', { normalizedEmail });
        return res.status(400).json({ message: 'E-mail já confirmado.' });
      }
  
      // Verificar se o código de confirmação está correto
      if (user.confirmationCode !== code) {
        this.logger.warn('[CONFIRM MAIL] Código de confirmação inválido.', {
          normalizedEmail,
          confirmationCodeEnviado: code,
          confirmationCodeEsperado: user.confirmationCode,
        });
        return res.status(400).json({ message: 'Código de confirmação inválido.' });
      }
  
      // Verificar se o código expirou
      const expirationDate = new Date(user.confirmationCodeExpires);
      if (expirationDate < new Date()) {
        this.logger.warn('[CONFIRM MAIL] Código de confirmação expirado.', {
          normalizedEmail,
          confirmationCodeExpires: user.confirmationCodeExpires,
          now: new Date().toISOString(),
        });
        return res.status(400).json({ message: 'Código de confirmação expirou.' });
      }
  
      // Atualizar o status do usuário no cache
      user.verificada = true;
      user.confirmationCode = null;
      user.confirmationCodeExpires = null;
  
      this.logger.debug('[CONFIRM MAIL] Atualizando status do usuário no cache.', { normalizedEmail, user });
  
      // Salvar os dados atualizados do usuário no cache com um TTL adequado (1 hora)
      await this.redisCacheManager.set(
        userCacheKey,
        JSON.stringify(user),
        3600
      );
      this.logger.info('[CONFIRM MAIL] Dados do usuário atualizados com sucesso no cache.', { userCacheKey });
  
      // Atualizar a chave USERS que contém os e-mails confirmados
      const usersCacheKey = 'USERS';
      let usersList = await this.redisCacheManager.get(usersCacheKey);
      this.logger.debug('[CONFIRM MAIL] Lista de usuários confirmados recuperada do cache.', { usersCacheKey, usersList });
  
      // Se usersList não existir ou não for um array, inicializa como array vazio.
      if (!usersList) {
        this.logger.warn('[CONFIRM MAIL] Chave USERS não encontrada no cache, iniciando lista vazia.');
        usersList = [];
      } else if (typeof usersList === 'string') {
        try {
          usersList = JSON.parse(usersList);
          this.logger.debug('[CONFIRM MAIL] Lista USERS convertida de string para array.', { usersList });
        } catch (parseError) {
          this.logger.error('[CONFIRM MAIL] Erro ao fazer parse de USERS.', {
            errorMessage: parseError.message,
            errorStack: parseError.stack,
          });
          // Fallback: inicializa a lista como array vazio se houver erro no parse
          usersList = [];
        }
      }
  
      // Se o e-mail ainda não estiver na lista, adiciona-o
      if (!usersList.includes(normalizedEmail)) {
        usersList.push(normalizedEmail);
        await this.redisCacheManager.set(
          usersCacheKey,
          JSON.stringify(usersList),
          604800 // TTL de 7 dias
        );
        this.logger.info('[CONFIRM MAIL] E-mail adicionado à lista de usuários confirmados.', { normalizedEmail, usersCacheKey });
      } else {
        this.logger.info('[CONFIRM MAIL] E-mail já presente na lista de usuários confirmados.', { normalizedEmail, usersCacheKey });
      }
  
      res.status(200).json({ message: 'E-mail confirmado com sucesso!' });
    } catch (error) {
      this.logger.error('[CONFIRM MAIL] Erro ao confirmar e-mail.', {
        errorMessage: error.message,
        errorStack: error.stack,
        requestBody: { email, code },
      });
      res.status(500).json({ message: 'Erro interno do servidor.' });
    }
  }
  async handleSavedOnRedis(userData, options = {}) {
    const functionName = '[handleSavedOnRedis]';
    const TTL = 604800; // 7 dias em segundos
  
    // Chaves auxiliares para controle de registros
    const keyNewUsers = 'REGISTERS_NEW_USERS';
    const usersKey = 'USERS';
  
    try {
      this.logger.info(
        `${functionName} Dados recebidos para salvar no Redis: ${JSON.stringify(userData)}`
      );
  
      if (typeof TTL !== 'number' || TTL <= 0) {
        throw new Error('O TTL fornecido deve ser um número positivo.');
      }
  
      // Verifica se o id e o email estão definidos (o id é o UUIDv4, mas agora usaremos o email para as chaves)
      const { id, email } = userData;
      if (!id) {
        throw new Error('O identificador do usuário (id) não foi definido em userData.');
      }
      if (!email) {
        throw new Error('O email do usuário não foi definido em userData.');
      }
  
      // Garantir consistência usando o e-mail em minúsculas
      const normalizedEmail = email.toLowerCase();
      // Mantém o userId recebido
      const userId = id;
  
      // Cria o pipeline
      const pipeline = this.redisCacheManager.pipeline();
  
      // 1. Armazena os dados do usuário com expiração usando o e-mail na chave
      pipeline.set(`USER_DATA_${normalizedEmail}`, JSON.stringify(userData), 'EX', TTL);
  
      // 2. Inicializa os saldos do usuário, utilizando chaves baseados no e-mail
      pipeline.set(`USER_FUNDS_BALANCE_${normalizedEmail}`, JSON.stringify({ funds: 0 }), 'EX', TTL);
      pipeline.set(`USER_BALANCE_${normalizedEmail}`, JSON.stringify({ balance: 0 }), 'EX', TTL);
  
      // 3. (Opcional) Atualiza a chave REGISTERS_NEW_USERS (armazenada como JSON de array)
      let registersJson = await this.redisCacheManager.get(keyNewUsers);
      let registersArray = [];
      if (registersJson) {
        try {
          registersArray = JSON.parse(registersJson);
        } catch (err) {
          this.logger.warn(`${functionName} Erro ao parsear a chave ${keyNewUsers}`, { error: err });
        }
      }
      // Aqui você pode optar por registrar o email ou o userId (ou ambos) – neste exemplo, usamos o email
      if (!registersArray.includes(normalizedEmail)) {
        registersArray.push(normalizedEmail);
      }
      pipeline.set(keyNewUsers, JSON.stringify(registersArray), 'EX', TTL);
  
      // 4. Atualiza a chave USERS armazenando um objeto com userId e email
      let usersJson = await this.redisCacheManager.get(usersKey);
      let usersArray = [];
      if (usersJson) {
        try {
          usersArray = JSON.parse(usersJson);
        } catch (err) {
          this.logger.warn(`${functionName} Erro ao parsear a chave ${usersKey}`, { error: err });
        }
      }
      // Verifica se já existe um objeto para o email informado
      const userExists = usersArray.some(u => u.email === normalizedEmail);
      if (!userExists) {
        usersArray.push({ userId, email: normalizedEmail });
      }
      pipeline.set(usersKey, JSON.stringify(usersArray), 'EX', TTL);
  
      // Executa o pipeline
      const results = await pipeline.exec();
      this.logger.info(
        `${functionName} Pipeline executado com resultados: ${JSON.stringify(results)}`
      );
  
      // Opcional: Recupera os dados para log
      const getOnRedis = await this.redisCacheManager.get(`USER_DATA_${normalizedEmail}`);
      const newUsersSet = await this.redisCacheManager.get(keyNewUsers);
      const usersSet = await this.redisCacheManager.get(usersKey);
      this.logger.info(
        `${functionName} DADOS NO REDIS: ${getOnRedis} | REGISTER NEW USERS: ${newUsersSet} | USERS: ${usersSet}`
      );
  
      // Inicializa os saldos do usuário no cache (pode envolver outras operações internas)
      try {
        await this.initializeUserBalancesOnCache(userId, normalizedEmail);
        this.logger.info('Saldos do usuário inicializados com sucesso.');
      } catch (balanceError) {
        this.logger.error('Erro ao inicializar saldos do usuário:', balanceError);
        // Tratar o erro conforme necessário...
      }
  
      // Processa o envio de email utilizando os dados presentes em userData
      const emailResult = await this.processEmail(normalizedEmail, userData.confirmationCode);
      if (!emailResult.success) {
        throw new Error(emailResult.message);
      }
  
      return {
        success: true,
        userData,
      };
    } catch (error) {
      this.logger.error(`${functionName} Erro ao salvar dados no Redis.`, {
        errorMessage: error.message,
        errorStack: error.stack,
      });
      throw error;
    }
  }

    
    

  async changePassword(req, res) {
    const { userId, oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Both old and new passwords are required.' });
    }

    try {
      const user = this.models.User.findByPk(User, userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Old password is incorrect.' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          message: 'New password must be at least 8 characters long.',
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await this.models.User.update(
        User,
        { password: hashedPassword },
        { where: { id: user.id.toString() } },
      );

      await this.emailService.enqueueEmail(
        user.email,
        'Confirmação de Troca de Senha',
        'passwordReset',
        { email: user.email },
      );

      res.json({ message: 'Password changed successfully.' });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ message: 'Failed to change password.' });
    }
  }

  setupRoutes(app) {
    app.post('/auth/register', this.validateRegister, this.registerUser);
    app.post('/auth/change-password', this.changePassword);
    app.post('/auth/confirm-email', this.confirmEmail);
    // Remova as rotas de login daqui, já que estão sendo tratadas pelo LoginController
  }
}

export default registerController;