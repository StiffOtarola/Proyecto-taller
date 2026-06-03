import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClienteFormPage } from './cliente-form.page';

describe('ClienteFormPage', () => {
  let component: ClienteFormPage;
  let fixture: ComponentFixture<ClienteFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ClienteFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
