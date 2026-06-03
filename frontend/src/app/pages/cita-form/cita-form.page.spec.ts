import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CitaFormPage } from './cita-form.page';

describe('CitaFormPage', () => {
  let component: CitaFormPage;
  let fixture: ComponentFixture<CitaFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CitaFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
