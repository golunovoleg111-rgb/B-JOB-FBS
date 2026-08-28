import { startApp } from './app-v2.js';

const root = document.getElementById('app');

if (!root) {
  throw new Error('B-JOB FBS: root element #app not found');
}

startApp(root);
