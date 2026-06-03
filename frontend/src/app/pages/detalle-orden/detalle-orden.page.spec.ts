import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetalleOrdenPage } from './detalle-orden.page';

describe('DetalleOrdenPage', () => {
  let component: DetalleOrdenPage;
  let fixture: ComponentFixture<DetalleOrdenPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DetalleOrdenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
