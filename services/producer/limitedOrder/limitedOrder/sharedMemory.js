const bufferSize = 1024 * 1024; // 1MB de Buffer
const buffer = new SharedArrayBuffer(bufferSize);
const view = new Uint8Array(buffer);
let index = 0;

export function storeOrderInMemory(order) {
    const orderStr = JSON.stringify(order);
    const encoded = new TextEncoder().encode(orderStr);

    if (index + encoded.length > bufferSize) {
        index = 0; // Reseta se atingir o limite
    }

    view.set(encoded, index);
    index += encoded.length;
}

export function getMemoryBuffer() {
    return new TextDecoder().decode(view);
}
