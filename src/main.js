import './styles.css';
import { startApp } from './app/app.js';

const root = document.getElementById('app');

if (!root) {
  throw new Error('B-JOB FBS: root element #app not found');
}

startApp(root);
