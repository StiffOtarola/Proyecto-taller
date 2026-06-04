import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PortalService } from '../../services/portal.service';

@Component({
  standalone: false,
  selector: 'app-portal-ordenes',
  templateUrl: './portal-ordenes.page.html',
  styleUrls: ['./portal-ordenes.page.scss'],
})
export class PortalOrdenesPage implements OnInit {
  ordenes: any[] = [];
  cargando = true;

  constructor(public portal: PortalService, private router: Router) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.portal.getOrdenes().subscribe({
      next: res => { this.ordenes = res.data; this.cargando = false; },
      error: () => { this.cargando = false; },
    });
  }

  abrir(id: number) { this.router.navigate(['/portal/orden', id]); }

  logout() {
    this.portal.logout();
    this.router.navigate(['/portal/login'], { replaceUrl: true });
  }
}
