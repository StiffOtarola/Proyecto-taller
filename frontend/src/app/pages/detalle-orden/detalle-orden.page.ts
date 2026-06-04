import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { OrdenesService } from '../../services/ordenes.service';
import { UsuariosService } from '../../services/usuarios.service';
import { AuthService } from '../../services/auth.service';
import { Orden, OrdenAvance, OrdenRepuesto, OrdenChecklist, OrdenFoto, EstadoOrden, ESTADO_CONFIG } from '../../models/orden.model';
import { Usuario } from '../../models/usuario.model';

@Component({ standalone: false,
  selector: 'app-detalle-orden',
  templateUrl: './detalle-orden.page.html',
  styleUrls: ['./detalle-orden.page.scss'],
})
export class DetalleOrdenPage implements OnInit {
  orden: Orden | null = null;
  avances: OrdenAvance[] = [];
  repuestos: OrdenRepuesto[] = [];
  fotos: OrdenFoto[] = [];
  tecnicos: Usuario[] = [];
  cargando = true;

  tipoFoto: OrdenFoto['tipo'] = 'ingreso';
  subiendoFoto = false;

  readonly tiposFoto: { valor: OrdenFoto['tipo']; label: string }[] = [
    { valor: 'ingreso', label: 'Ingreso' },
    { valor: 'diagnostico', label: 'Diagnóstico' },
    { valor: 'avance', label: 'Avance' },
    { valor: 'entrega', label: 'Entrega' },
  ];

  nuevoAvance = '';
  nuevoRepuesto: OrdenRepuesto = { nombre: '', cantidad: 1, costo_unitario: 0 };
  mostrarFormRepuesto = false;

  checklist: OrdenChecklist = {
    prueba_realizada: false,
    lavado: false,
    calidad_revisada: false,
    facturacion_lista: false,
    cliente_notificado: false,
    observaciones: '',
  };

  cierre = { metodo_pago: 'efectivo', garantia_dias: 30, observaciones_finales: '' };

  readonly estadosSiguientes: Record<EstadoOrden, EstadoOrden[]> = {
    recepcion:            ['diagnostico', 'cancelada'],
    diagnostico:          ['esperando_aprobacion', 'en_reparacion', 'cancelada'],
    esperando_aprobacion: ['esperando_repuestos', 'en_reparacion', 'cancelada'],
    esperando_repuestos:  ['en_reparacion', 'cancelada'],
    en_reparacion:        ['lista_entrega', 'cancelada'],
    lista_entrega:        ['entregada'],
    entregada:            [],
    cancelada:            [],
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ordenSvc: OrdenesService,
    private usuarioSvc: UsuariosService,
    public auth: AuthService,
    private alert: AlertController,
    private loading: LoadingController,
    private toast: ToastController
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.cargar(+id);
  }

  cargar(id: number) {
    this.cargando = true;
    this.ordenSvc.getById(id).subscribe(res => {
      this.orden = res.data;
      this.cargando = false;
    });
    this.ordenSvc.getAvances(id).subscribe(res => this.avances = res.data);
    this.ordenSvc.getRepuestos(id).subscribe(res => this.repuestos = res.data);
    this.ordenSvc.getFotos(id).subscribe(res => this.fotos = res.data);
    this.ordenSvc.getChecklist(id).subscribe(res => {
      if (res.data) {
        this.checklist = {
          prueba_realizada: !!res.data.prueba_realizada,
          lavado: !!res.data.lavado,
          calidad_revisada: !!res.data.calidad_revisada,
          facturacion_lista: !!res.data.facturacion_lista,
          cliente_notificado: !!res.data.cliente_notificado,
          observaciones: res.data.observaciones || '',
        };
      }
    });
    this.usuarioSvc.getAll().subscribe(res => {
      this.tecnicos = res.data.filter(u => u.rol === 'tecnico' && u.activo);
    });
  }

  estadoLabel(e: string) { return ESTADO_CONFIG[e as EstadoOrden]?.label ?? e; }
  estadoColor(e: string) { return ESTADO_CONFIG[e as EstadoOrden]?.color ?? 'medium'; }

  get siguientes(): EstadoOrden[] {
    if (!this.orden?.estado) return [];
    const lista = this.estadosSiguientes[this.orden.estado] || [];
    if (!this.auth.tieneRol('admin', 'gerencia')) {
      return lista.filter(e => e !== 'cancelada');
    }
    return lista;
  }

  async cambiarEstado(estado: EstadoOrden) {
    const conf = await this.alert.create({
      header: 'Cambiar estado',
      message: `¿Cambiar a "${this.estadoLabel(estado)}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Confirmar', handler: () => this.ejecutarCambioEstado(estado) },
      ],
    });
    await conf.present();
  }

  private async ejecutarCambioEstado(estado: EstadoOrden) {
    const l = await this.loading.create({ message: 'Cambiando estado...' });
    await l.present();
    this.ordenSvc.cambiarEstado(this.orden!.id!, estado).subscribe({
      next: async () => {
        await l.dismiss();
        this.cargar(this.orden!.id!);
        this.mostrarToast('Estado actualizado');
      },
      error: async (err) => {
        await l.dismiss();
        this.mostrarAlertError(err.error?.error);
      },
    });
  }

  async asignarTecnico(tecnico_id: number) {
    this.ordenSvc.asignarTecnico(this.orden!.id!, tecnico_id).subscribe({
      next: () => { this.cargar(this.orden!.id!); this.mostrarToast('Técnico asignado'); },
    });
  }

  agregarAvance() {
    if (!this.nuevoAvance.trim()) return;
    this.ordenSvc.addAvance(this.orden!.id!, this.nuevoAvance).subscribe({
      next: res => {
        this.avances.push(res.data);
        this.nuevoAvance = '';
        this.mostrarToast('Avance registrado');
      },
    });
  }

  agregarRepuesto() {
    if (!this.nuevoRepuesto.nombre.trim()) return;
    this.ordenSvc.addRepuesto(this.orden!.id!, this.nuevoRepuesto).subscribe({
      next: res => {
        this.repuestos.push(res.data);
        this.nuevoRepuesto = { nombre: '', cantidad: 1, costo_unitario: 0 };
        this.mostrarFormRepuesto = false;
        this.cargar(this.orden!.id!);
        this.mostrarToast('Repuesto agregado');
      },
    });
  }

  async eliminarRepuesto(r: OrdenRepuesto) {
    const conf = await this.alert.create({
      header: 'Eliminar repuesto',
      message: `¿Eliminar "${r.nombre}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          handler: () => {
            this.ordenSvc.deleteRepuesto(this.orden!.id!, r.id!).subscribe({
              next: () => {
                this.repuestos = this.repuestos.filter(x => x.id !== r.id);
                this.cargar(this.orden!.id!);
              },
            });
          },
        },
      ],
    });
    await conf.present();
  }

  get totalRepuestos() {
    return this.repuestos.reduce((s, r) => s + r.cantidad * r.costo_unitario, 0);
  }

  get totalOrden() {
    if (!this.orden) return 0;
    return (this.orden.costo_mano_obra || 0) + this.totalRepuestos - (this.orden.descuento || 0);
  }

  guardarChecklist() {
    this.ordenSvc.saveChecklist(this.orden!.id!, this.checklist).subscribe({
      next: () => this.mostrarToast('Checklist guardado'),
      error: (err) => this.mostrarAlertError(err.error?.error),
    });
  }

  get checklistCompleto(): boolean {
    const c = this.checklist;
    return c.prueba_realizada && c.lavado && c.calidad_revisada && c.facturacion_lista;
  }

  get puedeEntregar(): boolean {
    return this.orden?.estado === 'lista_entrega' && this.auth.tieneRol('jefe_taller', 'admin', 'gerencia');
  }

  async facturarYEntregar() {
    if (!this.checklistCompleto) {
      const a = await this.alert.create({
        header: 'Checklist incompleto',
        message: 'Completá prueba, lavado, calidad y facturación antes de entregar.',
        buttons: ['OK'],
      });
      await a.present();
      return;
    }

    const conf = await this.alert.create({
      header: 'Confirmar entrega',
      message: `Total a cobrar: ₡${this.totalOrden.toLocaleString('es-CR')}. ¿Cerrar la orden y marcarla como entregada?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Entregar', handler: () => this.ejecutarCierre() },
      ],
    });
    await conf.present();
  }

  private async ejecutarCierre() {
    const l = await this.loading.create({ message: 'Cerrando orden...' });
    await l.present();
    // Persistir checklist primero, luego cerrar
    this.ordenSvc.saveChecklist(this.orden!.id!, this.checklist).subscribe(() => {
      this.ordenSvc.cerrar(this.orden!.id!, this.cierre).subscribe({
        next: async () => {
          await l.dismiss();
          this.cargar(this.orden!.id!);
          this.mostrarToast('Orden entregada y facturada');
        },
        error: async (err) => {
          await l.dismiss();
          this.mostrarAlertError(err.error?.error);
        },
      });
    });
  }

  // ===== Fotos de evidencia =====
  get fotosPorTipo(): { tipo: string; label: string; fotos: OrdenFoto[] }[] {
    return this.tiposFoto
      .map(t => ({ tipo: t.valor, label: t.label, fotos: this.fotos.filter(f => f.tipo === t.valor) }))
      .filter(g => g.fotos.length > 0);
  }

  async onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.mostrarAlertError('El archivo debe ser una imagen');
      input.value = '';
      return;
    }

    this.subiendoFoto = true;
    try {
      const dataUrl = await this.comprimirImagen(file);
      this.ordenSvc.addFoto(this.orden!.id!, { url: dataUrl, tipo: this.tipoFoto }).subscribe({
        next: res => {
          this.fotos.push(res.data);
          this.subiendoFoto = false;
          this.mostrarToast('Foto agregada');
        },
        error: err => {
          this.subiendoFoto = false;
          this.mostrarAlertError(err.error?.error || 'No se pudo subir la foto');
        },
      });
    } catch {
      this.subiendoFoto = false;
      this.mostrarAlertError('No se pudo procesar la imagen');
    }
    input.value = '';
  }

  // Redimensiona a máx 1024px y comprime a JPEG q0.7 para reducir el peso del base64
  private comprimirImagen(file: File, maxLado = 1024, calidad = 0.7): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > maxLado) {
            height = Math.round((height * maxLado) / width);
            width = maxLado;
          } else if (height > maxLado) {
            width = Math.round((width * maxLado) / height);
            height = maxLado;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject();
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', calidad));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async verFoto(foto: OrdenFoto) {
    const a = await this.alert.create({
      cssClass: 'foto-preview-alert',
      message: `<img src="${foto.url}" style="width:100%;border-radius:8px" />`,
      buttons: ['Cerrar'],
    });
    await a.present();
  }

  async eliminarFoto(foto: OrdenFoto) {
    const conf = await this.alert.create({
      header: 'Eliminar foto',
      message: '¿Eliminar esta evidencia?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.ordenSvc.deleteFoto(this.orden!.id!, foto.id!).subscribe({
              next: () => {
                this.fotos = this.fotos.filter(f => f.id !== foto.id);
                this.mostrarToast('Foto eliminada');
              },
            });
          },
        },
      ],
    });
    await conf.present();
  }

  private async mostrarToast(msg: string) {
    const t = await this.toast.create({ message: msg, duration: 2000, color: 'success' });
    await t.present();
  }

  private async mostrarAlertError(msg?: string) {
    const a = await this.alert.create({ header: 'Error', message: msg || 'Ocurrió un error', buttons: ['OK'] });
    await a.present();
  }

  volver() { this.router.navigate(['/tabs/ordenes']); }
}
