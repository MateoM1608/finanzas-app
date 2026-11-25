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
import './composables/useTheme.js';

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

ChartJS.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
ChartJS.defaults.font.size = 12;
ChartJS.defaults.animation.duration = 400;

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.mount('#app');
