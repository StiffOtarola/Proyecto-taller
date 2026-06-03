import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DashboardService } from '../../services/dashboard.service';

@Component({ standalone: false,
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit {
  resumen: any = null;
  tecnicos: any[] = [];
  cargando = true;

  constructor(
    public auth: AuthService,
    private dashSvc: DashboardService,
    private router: Router
  ) {}

  ngOnInit() {
    this.cargar();
  }

  ionViewWillEnter() {
    this.cargar();
  }

  cargar() {
    this.cargando = true;
    this.dashSvc.getResumen().subscribe({
      next: res => {
        this.resumen = res.data;
        this.cargando = false;
      },
      error: () => { this.cargando = false; },
    });
    this.dashSvc.getTecnicos().subscribe({
      next: res => { this.tecnicos = res.data; },
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  irNuevaOrden() {
    this.router.navigate(['/nueva-orden']);
  }
}
