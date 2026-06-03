import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Cliente } from '../models/cliente.model';
import { Moto } from '../models/moto.model';
import { Orden } from '../models/orden.model';

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private url = `${environment.apiUrl}/clientes`;
  constructor(private http: HttpClient) {}

  getAll(q?: string): Observable<{ data: Cliente[] }> {
    const params: any = {};
    if (q) params['q'] = q;
    return this.http.get<{ data: Cliente[] }>(this.url, { params });
  }

  getById(id: number): Observable<{ data: Cliente }> {
    return this.http.get<{ data: Cliente }>(`${this.url}/${id}`);
  }

  create(cliente: Cliente): Observable<{ data: Cliente }> {
    return this.http.post<{ data: Cliente }>(this.url, cliente);
  }

  update(id: number, cliente: Cliente): Observable<{ data: Cliente }> {
    return this.http.put<{ data: Cliente }>(`${this.url}/${id}`, cliente);
  }

  getMotos(id: number): Observable<{ data: Moto[] }> {
    return this.http.get<{ data: Moto[] }>(`${this.url}/${id}/motos`);
  }

  getOrdenes(id: number): Observable<{ data: Orden[] }> {
    return this.http.get<{ data: Orden[] }>(`${this.url}/${id}/ordenes`);
  }
}
