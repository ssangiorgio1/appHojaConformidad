const horaFmt = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Argentina/Buenos_Aires",
});
const diaHoraFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Argentina/Buenos_Aires",
});

// Etiquetas del eje X (hora local de Argentina). Con un solo día alcanza la hora; en rangos de varios
// días (y también al hacer zoom dentro de ellos) hay que mostrar el día, o las etiquetas se repiten.
// El flag es global: lo fija el gráfico antes de renderizar, todos los de la página comparten rango.
let mostrarDia = false;
export function setEjeConDia(valor: boolean) {
  mostrarDia = valor;
}
export const shortDateFmt = {
  format: (d: Date) => (mostrarDia ? diaHoraFmt : horaFmt).format(d),
};

// Título del tooltip: día de la semana y fecha en español, hora de Argentina.
export const weekdayDateFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "America/Argentina/Buenos_Aires",
});

export const hmsTimeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

// `Intl.NumberFormat.prototype.format` is a bound getter — safe to extract.
export const intFmt = new Intl.NumberFormat("en-US").format;
