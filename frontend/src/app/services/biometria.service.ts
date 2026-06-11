import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

export interface CredencialesBio { email: string; password: string; }

const KEY = 'login';

// Ingreso con huella / Face ID para la app NATIVA.
// Tras un login exitoso, guarda las credenciales cifradas (Keystore/Keychain) protegidas
// por biometría; en el próximo arranque el usuario entra con su huella y se reloguea solo.
// Todo está gateado por Capacitor.isNativePlatform(): en web no hace nada.
@Injectable({ providedIn: 'root' })
export class BiometriaService {
  private readonly nativo = Capacitor.isNativePlatform();

  // ¿El dispositivo tiene biometría utilizable? (siempre false en web)
  async disponible(): Promise<boolean> {
    if (!this.nativo) return false;
    try {
      const r = await BiometricAuth.checkBiometry();
      return !!r.isAvailable;
    } catch {
      return false;
    }
  }

  // ¿Ya está activado el ingreso biométrico (hay credenciales guardadas)?
  async activado(): Promise<boolean> {
    if (!this.nativo) return false;
    try {
      return !!(await SecureStorage.get(KEY));
    } catch {
      return false;
    }
  }

  // Activa el ingreso biométrico: confirma identidad y guarda las credenciales cifradas.
  async activar(email: string, password: string): Promise<void> {
    if (!this.nativo) return;
    await BiometricAuth.authenticate({
      reason: 'Confirmá tu identidad para activar el ingreso rápido',
      cancelTitle: 'Cancelar',
      androidTitle: 'Ingreso rápido',
      allowDeviceCredential: false,
    });
    await SecureStorage.set(KEY, JSON.stringify({ email, password }));
  }

  // Pide biometría y devuelve las credenciales guardadas para reloguear.
  async obtener(): Promise<CredencialesBio | null> {
    if (!this.nativo) return null;
    await BiometricAuth.authenticate({
      reason: 'Ingresá con tu huella o Face ID',
      cancelTitle: 'Cancelar',
      androidTitle: 'Ingreso con biometría',
      allowDeviceCredential: true,
    });
    const v = await SecureStorage.get(KEY);
    if (!v) return null;
    try {
      return JSON.parse(v as string) as CredencialesBio;
    } catch {
      return null;
    }
  }

  // Desactiva el ingreso biométrico (borra las credenciales guardadas).
  async desactivar(): Promise<void> {
    try {
      await SecureStorage.remove(KEY);
    } catch {
      /* nada que borrar */
    }
  }
}
