import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { MecanicoService } from '../../services/mecanico.service';

@Component({
  standalone: false,
  selector: 'app-mecanico-tareas',
  templateUrl: './mecanico-tareas.page.html',
  styleUrls: ['./mecanico-tareas.page.scss'],
})
export class MecanicoTareasPage implements OnInit {
  tareas: any[] = [];
  cargando = true;
  mostrarForm = false;
  guardando = false;
  nueva = { titulo: '', detalle: '', prioridad: 'normal' };

  constructor(private mecanico: MecanicoService, private toast: ToastController) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar(ev?: any) {
    this.cargando = true;
    this.mecanico.getTareas().subscribe({
      next: r => { this.tareas = r.data; this.cargando = false; if (ev) ev.target.complete(); },
      error: () => { this.cargando = false; if (ev) ev.target.complete(); },
    });
  }

  get pendientes(): number { return this.tareas.filter(t => !t.hecha).length; }

  toggle(t: any) {
    const previo = t.hecha;
    t.hecha = t.hecha ? 0 : 1; // optimista
    this.mecanico.toggleTarea(t.id, !!t.hecha).subscribe({
      error: () => { t.hecha = previo; this.aviso('No se pudo actualizar', 'danger'); },
    });
  }

  agregar() {
    if (!this.nueva.titulo.trim()) { this.aviso('Escribí un título', 'warning'); return; }
    this.guardando = true;
    this.mecanico.addTarea({ titulo: this.nueva.titulo, detalle: this.nueva.detalle, prioridad: this.nueva.prioridad }).subscribe({
      next: () => {
        this.guardando = false;
        this.nueva = { titulo: '', detalle: '', prioridad: 'normal' };
        this.mostrarForm = false;
        this.cargar();
      },
      error: () => { this.guardando = false; this.aviso('No se pudo crear', 'danger'); },
    });
  }

  eliminar(t: any) {
    this.mecanico.deleteTarea(t.id).subscribe({
      next: () => { this.tareas = this.tareas.filter(x => x.id !== t.id); },
      error: () => this.aviso('No se pudo eliminar', 'danger'),
    });
  }

  private async aviso(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 1600, color });
    await t.present();
  }
}
