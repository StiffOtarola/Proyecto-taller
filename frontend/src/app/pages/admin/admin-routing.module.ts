import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminShellPage } from './admin-shell.page';
import { AdminResumenPage } from './admin-resumen.page';
import { AdminCitasPage } from './admin-citas.page';
import { AdminEmpleadosPage } from './admin-empleados.page';
import { AdminTareasPage } from './admin-tareas.page';
import { AdminReportesPage } from './admin-reportes.page';
import { AdminPromosPage } from './admin-promos.page';

const routes: Routes = [
  {
    path: '',
    component: AdminShellPage,
    children: [
      { path: '', redirectTo: 'resumen', pathMatch: 'full' },
      { path: 'resumen', component: AdminResumenPage },
      { path: 'citas', component: AdminCitasPage },
      { path: 'empleados', component: AdminEmpleadosPage },
      { path: 'tareas', component: AdminTareasPage },
      { path: 'reportes', component: AdminReportesPage },
      { path: 'promos', component: AdminPromosPage },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminPageRoutingModule {}
