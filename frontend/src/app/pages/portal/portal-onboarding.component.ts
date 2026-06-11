import { Component, OnInit } from '@angular/core';

// Tour de bienvenida (3 pasos) que se muestra una sola vez por dispositivo.
// Overlay autocontenido: se monta en el Inicio del portal y se autogestiona
// con un flag en localStorage. Sin dependencias externas.
@Component({
  standalone: false,
  selector: 'app-portal-onboarding',
  templateUrl: './portal-onboarding.component.html',
  styleUrls: ['./portal-onboarding.component.scss'],
})
export class PortalOnboardingComponent implements OnInit {
  private readonly KEY = 'tallerms_onboarding_visto';
  visible = false;
  paso = 0;

  readonly pasos = [
    {
      icon: 'calendar-outline',
      titulo: 'Agendá en segundos',
      texto: 'Elegí tu moto, el servicio y el horario. ¿Apurado? Tocá “Sugerir próximo horario libre”.',
    },
    {
      icon: 'construct-outline',
      titulo: 'Seguí tu moto en vivo',
      texto: 'Mirá el progreso, los avances y las fotos del taller. Confirmá tu asistencia con un toque.',
    },
    {
      icon: 'gift-outline',
      titulo: 'Ganá recompensas',
      texto: 'Cada varios servicios completados, el siguiente es de cortesía. Seguí tu progreso en Ofertas.',
    },
  ];

  ngOnInit() {
    this.visible = !localStorage.getItem(this.KEY);
  }

  get ultimo(): boolean { return this.paso === this.pasos.length - 1; }

  ir(i: number) { this.paso = i; }
  siguiente() { this.ultimo ? this.cerrar() : (this.paso++); }
  saltar() { this.cerrar(); }

  private cerrar() {
    localStorage.setItem(this.KEY, '1');
    this.visible = false;
  }
}
