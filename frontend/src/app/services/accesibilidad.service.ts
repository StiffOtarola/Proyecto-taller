import { Injectable } from '@angular/core';

// Preferencia de tamaño de texto (accesibilidad). Aplica un zoom global a la app
// mediante la variable CSS --app-zoom (ver global.scss). Persiste en localStorage
// y se aplica al arrancar. 3 niveles: Normal / Grande / Muy grande.
@Injectable({ providedIn: 'root' })
export class AccesibilidadService {
  private readonly KEY = 'tallerms_text_scale';
  private readonly escalas = [1, 1.12, 1.25];
  private idx = 0;

  constructor() {
    const guardado = Number(localStorage.getItem(this.KEY));
    const i = this.escalas.indexOf(guardado);
    this.idx = i >= 0 ? i : 0;
    this.aplicar();
  }

  /** Nivel actual: 0 = Normal, 1 = Grande, 2 = Muy grande. */
  get nivel(): number { return this.idx; }
  get niveles(): number { return this.escalas.length; }

  setNivel(i: number) {
    this.idx = Math.max(0, Math.min(this.escalas.length - 1, i));
    localStorage.setItem(this.KEY, String(this.escalas[this.idx]));
    this.aplicar();
  }

  private aplicar() {
    document.documentElement.style.setProperty('--app-zoom', String(this.escalas[this.idx]));
  }
}
