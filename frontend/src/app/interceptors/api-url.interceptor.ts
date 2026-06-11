import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { NATIVE_API_URL } from '../native-config';

// En la app nativa, las llamadas relativas a '/api/...' no tienen origen de servidor
// (el WebView carga assets locales). Este interceptor las reescribe a la URL absoluta
// del backend SOLO cuando corre en una plataforma nativa. En web es transparente.
@Injectable()
export class ApiUrlInterceptor implements HttpInterceptor {
  private readonly nativo = Capacitor.isNativePlatform();

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.nativo && req.url.startsWith('/api')) {
      return next.handle(req.clone({ url: `${NATIVE_API_URL}${req.url}` }));
    }
    return next.handle(req);
  }
}
