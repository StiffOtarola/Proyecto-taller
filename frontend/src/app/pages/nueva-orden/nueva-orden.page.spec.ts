import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NuevaOrdenPage } from './nueva-orden.page';

describe('NuevaOrdenPage', () => {
  let component: NuevaOrdenPage;
  let fixture: ComponentFixture<NuevaOrdenPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(NuevaOrdenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
