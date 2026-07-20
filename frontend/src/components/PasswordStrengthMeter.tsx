// Medidor de fuerza + checklist de requisitos. Extraído de AuthView para
// reutilizarlo tal cual en el registro Y en el admin (crear usuario / cambiar
// contraseña), sin duplicar la UI. La lógica vive en lib/passwordPolicy.ts.
import { checkPassword, passwordStrength, REQUIREMENT_ITEMS } from '../lib/passwordPolicy';
import type { PasswordStrength } from '../lib/passwordPolicy';

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  weak: 'Débil', medium: 'Media', strong: 'Fuerte',
};
const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  weak: 'var(--red)', medium: 'var(--amb)', strong: 'var(--grn)',
};
const STRENGTH_BARS: Record<PasswordStrength, number> = {
  weak: 1, medium: 2, strong: 3,
};

export function PasswordStrengthMeter({ pw }: { pw: string }) {
  const pwChecks = checkPassword(pw);
  const strength = passwordStrength(pw);
  return (
    <div style={{ marginTop:9 }}>
      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}>
        <div style={{ flex:1,display:'flex',gap:4 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ flex:1,height:4,borderRadius:2,background:pw.length>0&&i<STRENGTH_BARS[strength]?STRENGTH_COLOR[strength]:'var(--bdr)',transition:'background .2s' }}/>
          ))}
        </div>
        {pw.length > 0 && (
          <span style={{ fontSize:11,fontWeight:700,color:STRENGTH_COLOR[strength],minWidth:38,textAlign:'right' }}>
            {STRENGTH_LABEL[strength]}
          </span>
        )}
      </div>
      <div style={{ display:'flex',flexDirection:'column',gap:4 }}>
        {REQUIREMENT_ITEMS.map(({ key, label }) => {
          const met = pwChecks[key];
          const violated = key === 'notCommon' && pw.length > 0 && !met;
          const satisfied = met && pw.length > 0;
          const color = violated ? 'var(--red)' : satisfied ? 'var(--grn)' : 'var(--t3)';
          const icon  = violated ? '❌' : satisfied ? '✅' : '⭕';
          return (
            <div key={key} style={{ display:'flex',alignItems:'center',gap:6,fontSize:11.5,color }}>
              <span>{icon}</span>{label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
