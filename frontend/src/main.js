import { createApp } from 'vue';
import { createPinia } from 'pinia';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import App from './App.vue';
import { router } from './router/index.js';
import './assets/main.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
);

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.mount('#app');
