import { readStorage, removeStorage, writeStorage } from '../lib/browser';

const KEY = 'kort:product-moment';

export function setProductMoment(message: string) {
  writeStorage(KEY, message, 'session');
}

export function getProductMoment() {
  return readStorage(KEY, 'session');
}

export function clearProductMoment() {
  removeStorage(KEY, 'session');
}
