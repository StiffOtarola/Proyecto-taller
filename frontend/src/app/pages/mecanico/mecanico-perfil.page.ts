import { Component, OnDestroy, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { MecanicoService } from '../../services/mecanico.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  standalone: false,
  selector: 'app-mecanico-perfil',
  templateUrl: './mecanico-perfil.page.html',
  styleUrls: ['./mecanico.page.scss', './mecanico-perfil.page.scss'],
})
export class MecanicoPerfilPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  perfil: any = null;
  cargando = true;
  editando = false;
  guardando = false;
  form = { telefono: '', especialidades: '', horario: '' };

  constructor(private mecanico: MecanicoService, private toast: ToastController) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  cargar(ev?: any) {
    this.cargando = true;
    this.mecanico.getPerfil().pipe(takeUntil(this.destroy$)).subscribe({
      next: r => { this.perfil = r.data; this.cargando = false; if (ev) ev.target.complete(); },
      error: () => { this.cargando = false; if (ev) ev.target.complete(); },
    });
  }

  estrellas(prom: number | null): string {
    if (!prom) return '—';
    const llenas = Math.round(prom);
    return '★'.repeat(llenas) + '☆'.repeat(5 - llenas);
  }

  formatMin(min: number | null | undefined): string {
    if (!min) return '—';
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h ? `${h}h ${m}m` : `${m}m`;
  }

  abrirEditar() {
    this.form = {
      telefono: this.perfil?.telefono || '',
      especialidades: this.perfil?.especialidades || '',
      horario: this.perfil?.horario || '',
    };
    this.editando = true;
  }

  guardar() {
    this.guardando = true;
    this.mecanico.actualizarPerfil(this.form).pipe(takeUntil(this.destroy$)).subscribe({
      next: async () => {
        this.guardando = false;
        this.editando = false;
        const t = await this.toast.create({ message: 'Perfil actualizado', duration: 1500, color: 'success' });
        await t.present();
        this.cargar();
      },
      error: async () => {
        this.guardando = false;
        const t = await this.toast.create({ message: 'No se pudo guardar', duration: 2000, color: 'danger' });
        await t.present();
      },
    });
  }
}
