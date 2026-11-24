import Link from 'next/link';
import { NexorMark } from '@/components/NexorLogo';
import { CONTACT_EMAIL, PRIVACY_UPDATED, SITE_NAME } from '@/lib/site';

export const metadata = {
  title: 'Política de privacidad',
  description: 'Qué datos trata Nexor Vault y su extensión de navegador, y cuáles nunca puede leer.',
};

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-9 text-[20px] font-black tracking-tight">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[15px] leading-relaxed text-mist">{children}</p>;
}
function Li({ children }: { children: React.ReactNode }) {
  return <li className="text-[15px] leading-relaxed text-mist">{children}</li>;
}

export default function PrivacyPage() {
  return (
    <div data-section="home" className="nexor-mesh-bg min-h-dvh bg-void text-foreground">
      <header className="nexor-glass sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <NexorMark size={24} id="privacy" />
            <span className="text-[15px] font-black tracking-[0.18em]">NEXOR</span>
          </Link>
          <nav className="flex gap-4 text-[13px] font-semibold text-dim">
            <a href="#es" className="hover:text-purple">Español</a>
            <a href="#en" className="hover:text-purple">English</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-20 pt-10">
        {/* ───────────── ESPAÑOL ───────────── */}
        <article id="es" className="scroll-mt-20">
          <h1 className="text-[34px] font-black leading-tight tracking-tight">Política de privacidad</h1>
          <p className="mt-2 text-[13px] text-dim">
            {SITE_NAME} y su extensión de navegador · Última actualización: {PRIVACY_UPDATED}
          </p>

          <H>En resumen</H>
          <ul className="list-disc space-y-1.5 pl-5">
            <Li>Tus contraseñas se cifran <b>en tu dispositivo</b> antes de enviarse. No podemos leerlas ni descifrarlas, aunque quisiéramos.</Li>
            <Li>Tu master password <b>nunca sale de tu dispositivo</b>.</Li>
            <Li>No hay publicidad, ni analítica, ni rastreo, ni venta o cesión de datos a terceros.</Li>
            <Li>La extensión solo se comunica con el servidor de Nexor y no guarda tu historial de navegación.</Li>
          </ul>

          <H>1. Quién trata tus datos</H>
          <P>
            El responsable del servicio es el equipo de {SITE_NAME}. Para cualquier cuestión sobre privacidad escribe a{' '}
            <a className="font-semibold text-purple underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </P>

          <H>2. Qué datos tratamos</H>
          <P><b>Datos de tu cuenta</b></P>
          <ul className="mb-3 list-disc space-y-1.5 pl-5">
            <Li>Tu <b>email</b>, para identificarte y permitirte iniciar sesión.</Li>
            <Li>Un <b>hash de autenticación</b> derivado de tu master password en tu dispositivo (no es tu contraseña ni permite obtenerla), junto con un <i>salt</i> aleatorio y los parámetros de derivación de clave.</Li>
            <Li>Tu clave pública y tu clave privada <b>cifrada</b> (para compartir accesos). Si activas el 2FA de la cuenta, el secreto TOTP.</Li>
          </ul>
          <P><b>Contenido de tu bóveda (siempre cifrado)</b></P>
          <ul className="mb-3 list-disc space-y-1.5 pl-5">
            <Li>Accesos (título, usuario, contraseña, URL, notas, secreto 2FA), carpetas, equipos y elementos compartidos se almacenan <b>únicamente cifrados</b> (AES-GCM, con una clave que solo existe en tus dispositivos). Nosotros solo vemos datos cifrados.</Li>
          </ul>
          <P><b>Datos técnicos mínimos</b></P>
          <ul className="mb-3 list-disc space-y-1.5 pl-5">
            <Li>Token de sesión (cookie o cabecera) para mantener tu sesión abierta.</Li>
            <Li>Un registro de intentos fallidos de inicio de sesión (identificador y fecha) para frenar ataques de fuerza bruta.</Li>
            <Li>Si activas las notificaciones push: la suscripción de tu navegador (dirección del servicio push y claves públicas).</Li>
          </ul>

          <H>3. La extensión de navegador</H>
          <P>La extensión rellena tus credenciales cuando se lo pides. Esto es exactamente lo que hace con los datos:</P>
          <ul className="mb-3 list-disc space-y-1.5 pl-5">
            <Li><b>Lee la dirección (URL) de la pestaña activa solo cuando abres la extensión o usas el atajo</b> (permiso <i>activeTab</i>), para compararla con tus accesos y rellenar solo si el dominio coincide. No la guarda ni la envía a nadie.</Li>
            <Li>Escribe el usuario, la contraseña y el código 2FA en los campos de la página que tú eliges. Nunca envía el formulario por ti.</Li>
            <Li>Se comunica <b>únicamente con el servidor de Nexor</b> por HTTPS para iniciar sesión y descargar tu bóveda cifrada. Los datos se descifran en tu navegador.</Li>
            <Li>Tu master password no se guarda ni se envía.</Li>
            <Li>La <b>clave de la bóveda</b> en claro se mantiene <b>solo en memoria</b> y se borra al bloquear (automáticamente tras 10 minutos de inactividad) o al cerrar el navegador.</Li>
            <Li>Para que no tengas que iniciar sesión de nuevo cada vez que abres el navegador, la extensión guarda en su almacenamiento local tu <b>cuenta</b> (email, servidor y salt) y un <b>token de sesión de hasta 14 días</b>. Con ese token no se puede leer tu bóveda (está cifrada), pero sí hablar con el servidor en tu nombre hasta que caduque: puedes borrarlo en cualquier momento con «Cerrar sesión».</Li>
            <Li>Si activas el <b>desbloqueo con huella, Face ID o llave de seguridad</b>, se guarda tu clave de la bóveda <b>cifrada</b> con un secreto que solo tu autenticador puede calcular (WebAuthn PRF). Tu huella o rostro nunca salen del dispositivo ni llegan a Nexor.</Li>
            <Li><b>Aviso «¿Guardar contraseña?» (opcional, desactivado por defecto)</b>: si lo activas, el navegador te pedirá permiso para ver las webs. Entonces la extensión detecta cuando envías un formulario de inicio de sesión y puede ofrecerte guardarlo. El usuario y la contraseña se mantienen <b>solo en memoria</b> durante unos minutos y únicamente se cifran y se guardan si pulsas «Guardar»; si no, se descartan. El aviso aparece en el popup de la extensión, nunca dentro de la página. No actúa en el servidor de Nexor ni en las webs donde pulses «Nunca». Puedes desactivarlo cuando quieras y se retira el permiso.</Li>
            <Li>No incluye código remoto, ni analítica, ni rastreadores, ni anuncios, y no lee el contenido de las páginas más allá de localizar los campos de inicio de sesión al rellenar.</Li>
          </ul>

          <H>4. Terceros</H>
          <ul className="mb-3 list-disc space-y-1.5 pl-5">
            <Li><b>Supabase</b> (base de datos, región UE) y el proveedor de alojamiento del servidor: almacenan datos ya cifrados y los datos de cuenta descritos arriba.</Li>
            <Li><b>Have I Been Pwned</b> (solo en la web, y solo si pulsas «Comprobar filtraciones»): se envían los 5 primeros caracteres del hash SHA-1 de cada contraseña (<i>k-anonimato</i>); la contraseña real nunca sale de tu navegador.</Li>
          </ul>
          <P>No vendemos ni cedemos tus datos, y no los usamos para publicidad, perfiles ni decisiones automatizadas.</P>

          <H>5. Conservación y eliminación</H>
          <P>Conservamos los datos mientras tu cuenta exista. Puedes pedir la eliminación de tu cuenta y de todos sus datos escribiendo al correo de contacto; la atenderemos sin demora indebida.</P>

          <H>6. Tus derechos</H>
          <P>
            Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad (RGPD) escribiendo a{' '}
            <a className="font-semibold text-purple underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).
          </P>

          <H>7. Seguridad y límites</H>
          <P>
            Usamos Argon2id y HKDF para derivar tus claves y AES-GCM para cifrar. Como no tenemos tu master password, <b>no podemos recuperar tu bóveda si la olvidas</b>. Ningún sistema es infalible: protege tu master password y activa el 2FA.
          </P>

          <H>8. Cambios</H>
          <P>Si cambiamos esta política, actualizaremos la fecha de arriba y, si el cambio es importante, te avisaremos en la aplicación.</P>
        </article>

        <hr className="my-14 border-line" />

        {/* ───────────── ENGLISH ───────────── */}
        <article id="en" className="scroll-mt-20">
          <h1 className="text-[34px] font-black leading-tight tracking-tight">Privacy policy</h1>
          <p className="mt-2 text-[13px] text-dim">
            {SITE_NAME} and its browser extension · Last updated: November 24, 2026
          </p>

          <H>Summary</H>
          <ul className="list-disc space-y-1.5 pl-5">
            <Li>Your passwords are encrypted <b>on your device</b> before being sent. We cannot read them.</Li>
            <Li>Your master password <b>never leaves your device</b>.</Li>
            <Li>No ads, no analytics, no tracking, and we never sell or share data with third parties.</Li>
            <Li>The extension only talks to the Nexor server and does not store your browsing history.</Li>
          </ul>

          <H>Data we process</H>
          <ul className="list-disc space-y-1.5 pl-5">
            <Li><b>Account:</b> your email, an authentication hash derived on your device (it is not your password), a random salt and key-derivation parameters, your public key and your encrypted private key, and the 2FA secret if you enable account 2FA.</Li>
            <Li><b>Vault content:</b> stored only in encrypted form (AES-GCM); the key exists only on your devices.</Li>
            <Li><b>Minimal technical data:</b> a session token, failed-login attempt records (to stop brute-force attacks) and, if you enable push notifications, your browser&apos;s push subscription.</Li>
          </ul>

          <H>Browser extension</H>
          <ul className="list-disc space-y-1.5 pl-5">
            <Li>Reads the URL of the active tab <b>only when you open the extension or use the shortcut</b> (<i>activeTab</i> permission) to match it against your saved logins. It is neither stored nor sent anywhere.</Li>
            <Li>Writes the username, password and 2FA code into the fields of the page you choose. It never submits the form for you.</Li>
            <Li>Communicates <b>only with the Nexor server</b> over HTTPS to sign in and download your encrypted vault, which is decrypted in your browser.</Li>
            <Li>The master password is never stored or sent. The plaintext vault key is kept <b>in memory only</b> and cleared when the vault locks (automatically after 10 minutes of inactivity) or the browser closes.</Li>
            <Li>So you do not have to sign in again every time the browser opens, the extension stores in local storage your <b>account</b> (email, server, salt) and a <b>session token valid for up to 14 days</b>. It cannot decrypt your vault, but it can talk to the server on your behalf until it expires; &ldquo;Sign out&rdquo; deletes it.</Li>
            <Li>If you enable <b>unlock with fingerprint, Face ID or a security key</b>, your vault key is stored <b>encrypted</b> with a secret only your authenticator can compute (WebAuthn PRF). Your biometrics never leave the device or reach Nexor.</Li>
            <Li><b>&ldquo;Save password?&rdquo; prompt (optional, off by default):</b> if you turn it on, the browser asks for permission to see websites. The extension then detects when you submit a login form and can offer to save it. The username and password are kept <b>in memory only</b> for a few minutes and are encrypted and stored only if you press &ldquo;Save&rdquo;; otherwise they are discarded. The prompt appears in the extension popup, never inside the page. It does not act on the Nexor server or on sites where you chose &ldquo;Never&rdquo;. You can turn it off at any time, which removes the permission.</Li>
            <Li>No remote code, analytics, trackers or ads.</Li>
          </ul>

          <H>Third parties</H>
          <P>
            Supabase (database, EU region) and our hosting provider store the encrypted data and account data above. On the website only, and only if you click &ldquo;Check breaches&rdquo;, the first 5 characters of each password&apos;s SHA-1 hash are sent to Have I Been Pwned (k-anonymity).
          </P>

          <H>Retention, rights and contact</H>
          <P>
            We keep data while your account exists. You can request access, correction, deletion or portability of your data, or the deletion of your account, at{' '}
            <a className="font-semibold text-purple underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Because we do not have your master password, we cannot recover your vault if you forget it.
          </P>
        </article>
      </main>
    </div>
  );
}
