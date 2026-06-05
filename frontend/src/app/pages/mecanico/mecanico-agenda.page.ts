import { Component, OnInit } from '@angular/core';
import { MecanicoService } from '../../services/mecanico.service';

@Component({
  standalone: false,
  selector: 'app-mecanico-agenda',
  templateUrl: './mecanico-agenda.page.html',
  styleUrls: ['./mecanico.page.scss'],
})
export class MecanicoAgendaPage implements OnInit {
  cargando = true;
  offsetSemana = 0; // 0 = esta semana, -1 anterior, +1 siguiente
  dias: { fecha: string; etiqueta: string; citas: any[] }[] = [];
  rango = '';

  readonly estadoLabel: Record<string, string> = {
    agendado: 'Agendado', en_revision: 'En revisión', en_mantenimiento: 'En mantenimiento',
    listo: 'Listo', entregado: 'Entregado', cancelado: 'Cancelado',
  };
  readonly estadoPill: Record<string, string> = {
    agendado: 'gris', en_revision: 'amber', en_mantenimiento: 'rose',
    listo: 'indigo', entregado: 'green', cancelado: 'gris',
  };

  constructor(private mecanico: MecanicoService) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  // Lunes de la semana objetivo.
  private lunesDe(offset: number): Date {
    const d = new Date();
    const dia = (d.getDay() + 6) % 7; // 0 = lunes
    d.setDate(d.getDate() - dia + offset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private iso(d: Date): string { return d.toISOString().slice(0, 10); }

  cambiarSemana(delta: number) { this.offsetSemana += delta; this.cargar(); }

  cargar() {
    this.cargando = true;
    const lunes = this.lunesDe(this.offsetSemana);
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
    const desde = this.iso(lunes), hasta = this.iso(domingo);
    this.rango = `${lunes.toLocaleDateString('es', { day: 'numeric', month: 'short' })} – ${domingo.toLocaleDateString('es', { day: 'numeric', month: 'short' })}`;

    // Arma los 7 días vacíos
    const nombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    this.dias = Array.from({ length: 7 }, (_, i) => {
      const f = new Date(lunes); f.setDate(lunes.getDate() + i);
      return { fecha: this.iso(f), etiqueta: `${nombres[i]} ${f.getDate()}`, citas: [] };
    });

    this.mecanico.getAgenda(desde, hasta).subscribe({
      next: r => {
        for (const c of r.data) {
          const dia = this.dias.find(d => d.fecha === c.fecha?.slice(0, 10));
          if (dia) dia.citas.push(c);
        }
        this.cargando = false;
      },
      error: () => { this.cargando = false; },
    });
  }
}
