import { createStore } from './core/store.js';
import { createAuth } from './auth/auth.js';
import { renderLogin, renderShell } from './ui.js';
import './styles.css';
const store=createStore();const auth=createAuth(store);auth.restore();const root=document.querySelector('#app');
function render(){root.innerHTML=auth.currentUser?renderShell(auth.currentUser):renderLogin();const form=root.querySelector('#login-form');form?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(form),r=auth.login(String(f.get('login')||''),String(f.get('password')||''));if(!r.ok)root.querySelector('#login-error').textContent=r.error;else render()});root.querySelector('#logout')?.addEventListener('click',()=>{auth.logout();render()})}render();
