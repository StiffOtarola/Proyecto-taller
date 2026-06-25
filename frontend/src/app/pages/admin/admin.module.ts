import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { AdminPageRoutingModule } from './admin-routing.module';
import { AdminShellPage } from './admin-shell.page';
import { AdminResumenPage } from './admin-resumen.page';
import { AdminCitasPage } from './admin-citas.page';
import { AdminEmpleadosPage } from './admin-empleados.page';
import { AdminTareasPage } from './admin-tareas.page';
import { AdminReportesPage } from './admin-reportes.page';
import { AdminPromosPage } from './admin-promos.page';
import { AdminCalendarioPage } from './admin-calendario.page';
import { AdminConfigPage } from './admin-config.page';
import { AdminMensajesPage } from './admin-mensajes.page';
import { AdminActionsComponent } from './admin-actions.component';

@NgModule({
  imports: [SharedModule, AdminPageRoutingModule],
  declarations: [
    AdminShellPage,
    AdminResumenPage,
    AdminCitasPage,
    AdminEmpleadosPage,
    AdminTareasPage,
    AdminReportesPage,
    AdminPromosPage,
    AdminCalendarioPage,
    AdminConfigPage,
    AdminMensajesPage,
    AdminActionsComponent,
  ],
})
export class AdminPageModule {}
