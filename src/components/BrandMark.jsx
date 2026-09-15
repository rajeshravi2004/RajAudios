export function BrandMark({ size = 44 }) {
  return <img src={`${import.meta.env.BASE_URL}rajaudios-logo.png`} alt="Rajify logo" width={size} height={size} style={{ display: 'block', width: size, height: size, flexShrink: 0, borderRadius: Math.round(size / 4) }} />
}
