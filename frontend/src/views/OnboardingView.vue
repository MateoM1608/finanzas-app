<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { crearHogar, unirseHogar } from '../api/hogares.js';
import { extractErrorMessage } from '../api/client.js';
import FormField from '../components/FormField.vue';
import AlertError from '../components/AlertError.vue';
import AppIcon from '../components/AppIcon.vue';
import ThemeToggle from '../components/ThemeToggle.vue';

const router = useRouter();
const auth = useAuthStore();

const modo = ref('crear'); // 'crear' | 'unirse'
const error = ref('');
const loading = ref(false);

const nombreHogar = ref('');
const codigo = ref('');

// Opciones de onboarding mostradas como tarjetas (solo presentación).
const opciones = [
  { id: 'crear', icono: 'home', titulo: 'Crear hogar', texto: 'Empieza uno nuevo e invita a los demás.' },
  { id: 'unirse', icono: 'users', titulo: 'Unirme con código', texto: 'Usa la invitación que te compartieron.' },
];

// Puntos de valor del panel de marca (solo presentación).
const beneficios = [
  { icono: 'wallet', titulo: 'Disponible real', texto: 'Ingresos recibidos menos gastos pagados, sin estimaciones.' },
  { icono: 'scale', titulo: 'Cuadre de cuentas', texto: 'Saldo en vivo de quién le debe a quién, y cuadren cuando quieran.' },
  { icono: 'piggy', titulo: 'Ahorros y límites', texto: 'Metas con sugerencias automáticas y alertas por categoría.' },
];

async function onCrear() {
  error.value = '';
  loading.value = true;
  try {
    const { usuario } = await crearHogar({ nombre: nombreHogar.value });
    auth.setUsuario(usuario);
    router.push({ name: 'panel-personal' });
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function onUnirse() {
  error.value = '';
  loading.value = true;
  try {
    const { usuario } = await unirseHogar(codigo.value.trim().toUpperCase());
    auth.setUsuario(usuario);
    router.push({ name: 'panel-personal' });
  } catch (e) {
    error.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

function cambiarModo(nuevo) {
  modo.value = nuevo;
  error.value = '';
}
</script>

<template>
  <div class="min-h-screen bg-canvas lg:grid lg:grid-cols-2">
    <!-- Panel de marca: solo en pantallas grandes -->
    <aside class="hidden lg:flex flex-col justify-between border-r border-border bg-surface-sunken p-12 xl:p-16">
      <div class="flex items-center gap-2.5">
        <span class="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-on">
          <AppIcon name="logo" class="h-5 w-5" :stroke-width="2.4" />
        </span>
        <span class="text-[15px] font-semibold tracking-tight text-ink-primary">Finanzas</span>
      </div>

      <div class="max-w-md">
        <h2 class="text-display text-ink-primary">Un hogar, cuentas claras para todos.</h2>
        <p class="mt-4 text-[15px] leading-relaxed text-ink-secondary">
          El hogar reúne los gastos compartidos; tu panel personal sigue siendo solo tuyo.
        </p>

        <ul class="mt-10 space-y-6">
          <li v-for="b in beneficios" :key="b.titulo" class="flex gap-4">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface text-accent shadow-card">
              <AppIcon :name="b.icono" class="h-5 w-5" />
            </span>
            <div>
              <p class="text-sm font-semibold text-ink-primary">{{ b.titulo }}</p>
              <p class="mt-0.5 text-[13px] leading-relaxed text-ink-secondary">{{ b.texto }}</p>
            </div>
          </li>
        </ul>
      </div>

      <p class="text-xs text-ink-tertiary">Montos en pesos colombianos · datos personales privados por usuario</p>
    </aside>

    <main class="flex min-h-screen flex-col px-4 py-5 sm:px-8">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5 lg:invisible">
          <span class="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-on">
            <AppIcon name="logo" class="h-5 w-5" :stroke-width="2.4" />
          </span>
          <span class="text-[15px] font-semibold tracking-tight text-ink-primary">Finanzas</span>
        </div>
        <ThemeToggle />
      </div>

      <div class="flex flex-1 items-center justify-center py-10">
        <div class="w-full max-w-md">
          <div class="mb-7">
            <p class="text-[13px] font-medium text-accent">Un último paso</p>
            <h1 class="page-title mt-1">Configura tu hogar</h1>
            <p class="page-subtitle">Crea un hogar nuevo o únete a uno que ya exista.</p>
          </div>

          <div class="mb-4 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Cómo quieres empezar">
            <button
              v-for="op in opciones"
              :key="op.id"
              type="button"
              role="radio"
              :aria-checked="modo === op.id"
              class="relative flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-[background-color,border-color,box-shadow] duration-150"
              :class="
                modo === op.id
                  ? 'border-accent bg-accent/10 ring-2 ring-accent/20'
                  : 'border-border bg-surface shadow-card hover:border-border-strong hover:bg-surface-hover'
              "
              @click="cambiarModo(op.id)"
            >
              <span
                class="grid h-10 w-10 place-items-center rounded-xl"
                :class="modo === op.id ? 'bg-accent text-accent-on' : 'bg-surface-sunken text-ink-secondary'"
              >
                <AppIcon :name="op.icono" class="h-5 w-5" />
              </span>
              <span>
                <span class="block text-sm font-semibold text-ink-primary">{{ op.titulo }}</span>
                <span class="mt-0.5 block text-xs leading-snug text-ink-secondary">{{ op.texto }}</span>
              </span>
              <span
                v-if="modo === op.id"
                class="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-on"
                aria-hidden="true"
              >
                <AppIcon name="check" class="h-3 w-3" :stroke-width="3" />
              </span>
            </button>
          </div>

          <form v-if="modo === 'crear'" class="card card-pad space-y-5" @submit.prevent="onCrear">
            <AlertError :message="error" />

            <FormField v-model="nombreHogar" label="Nombre del hogar" required placeholder="Casa de Mateo y Dani" />

            <p class="text-xs text-ink-tertiary">
              Sin fechas fijas de corte: registran los gastos del hogar y cuadran cuentas cuando quieran.
            </p>

            <button type="submit" class="btn-primary w-full" :disabled="loading">
              {{ loading ? 'Creando…' : 'Crear hogar' }}
            </button>
          </form>

          <form v-else class="card card-pad space-y-5" @submit.prevent="onUnirse">
            <AlertError :message="error" />

            <FormField
              v-model="codigo"
              label="Código de invitación"
              required
              placeholder="ABCD1234"
              hint="Pídelo a quien administra el hogar; es de un solo uso."
            />

            <button type="submit" class="btn-primary w-full" :disabled="loading">
              {{ loading ? 'Uniéndote…' : 'Unirme al hogar' }}
            </button>
          </form>
        </div>
      </div>
    </main>
  </div>
</template>
