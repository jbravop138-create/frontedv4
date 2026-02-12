import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  loading = signal(false);
  errorMsg = signal<string | null>(null);

  form: FormGroup;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.nonNullable.group({
      identifier: ['', [Validators.required, Validators.minLength(2)]],
      password: ['', [Validators.required, Validators.minLength(4)]],
    });
  }

  private tryLogin(identifier: string, password: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.auth.login(identifier, password).subscribe({
        next: (res) => resolve(res),
        error: (err) => reject(err),
      });
    });
  }

  async submit() {
    this.errorMsg.set(null);

    if (this.form.invalid) {
      this.errorMsg.set('Completa usuario y contraseña.');
      this.form.markAllAsTouched();
      return;
    }

    const { identifier, password } = this.form.getRawValue();
    this.loading.set(true);

    try {
      const res = await this.tryLogin(identifier.trim(), password);
      const { token, user } = this.extractSession(res);
      if (!token || !user) {
        this.errorMsg.set('Token inválido o respuesta de login incompleta.');
        this.loading.set(false);
        return;
      }
      this.auth.setSession(token, user);
      const role = user?.role;
      this.router.navigateByUrl(role === 'admin' ? '/admin' : '/user');
    } catch (e1: any) {

      const id = identifier.trim();
      const isEmail = id.includes('@');

      if (!isEmail) {
        try {

          const res2 = await this.tryLogin(`${id}@stock360.com`, password);
          const s2 = this.extractSession(res2);
          if (!s2.token || !s2.user) throw new Error('Token inválido');
          this.auth.setSession(s2.token, s2.user);
          const role = s2.user?.role;
          this.router.navigateByUrl(role === 'admin' ? '/admin' : '/user');
          this.loading.set(false);
          return;
        } catch (e2: any) {
          try {

            const res3 = await this.tryLogin(`${id}@stock360.local`, password);
            const s3 = this.extractSession(res3);
            if (!s3.token || !s3.user) throw new Error('Token inválido');
            this.auth.setSession(s3.token, s3.user);
            const role = s3.user?.role;
            this.router.navigateByUrl(role === 'admin' ? '/admin' : '/user');
            this.loading.set(false);
            return;
          } catch (e3: any) {

          }
        }
      }

      const msg =
        e1?.error?.message ||
        e1?.message ||
        'No se pudo iniciar sesión. Verifica usuario/contraseña.';
      this.errorMsg.set(String(msg));
    } finally {
      this.loading.set(false);
    }
  }

  private extractSession(res: any): { token: string | null; user: any | null } {
    const token =
      res?.token ??
      res?.access_token ??
      res?.data?.token ??
      res?.data?.access_token ??
      null;
    const user = res?.user ?? res?.data?.user ?? null;
    return { token, user };
  }
}
