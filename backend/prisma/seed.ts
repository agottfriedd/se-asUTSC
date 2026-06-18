import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

const LESSONS = [
  {
    order:1, title:'Introducción a la LSM', description:'Historia, importancia y cultura de la comunidad sorda en México',
    level:'BASICO' as const, duration:15, modules:5, locked:false,
    content: [
      {type:'intro',title:'¿Qué es la LSM?',body:'La Lengua de Señas Mexicana (LSM) es el idioma visual-gestual propio de la Comunidad Sorda en México. Tiene gramática, sintaxis y estructura completamente independientes del español escrito.'},
      {type:'highlight',emoji:'⚠️',body:'La LSM NO es una mímica del español. Es un idioma completo reconocido legalmente en México desde 2003 (Ley General para la Inclusión de las Personas con Discapacidad).'},
      {type:'stats',items:[{n:'150,000+',l:'hablantes de LSM en México'},{n:'2003',l:'año del reconocimiento legal'},{n:'7',l:'dialectos regionales documentados'}]},
      {type:'body',title:'¿Por qué aprenderla en UTSC?',body:'Una parte significativa de la comunidad de UTSC incluye personas sordas o con deficiencia auditiva. Aprender LSM básico te permite comunicarte directamente, respetando su identidad cultural y lingüística — ODS 4 y ODS 10 en acción.'},
      {type:'quiz',q:'¿La LSM y el Español Signado son el mismo sistema?',opts:['Sí, son equivalentes','No, son sistemas distintos','Son variantes del español','La LSM no tiene gramática'],correct:1,feedback:'¡Correcto! El Español Signado sigue la gramática del español. La LSM es un idioma natural con gramática espacial propia.'},
    ]
  },
  {
    order:2, title:'Dactilología A–M', description:'Aprende las primeras 14 letras del abecedario manual LSM',
    level:'BASICO' as const, duration:20, modules:7, locked:false,
    content: [
      {type:'intro',title:'El abecedario manual LSM (A–M)',body:'La dactilología es el sistema de representación manual de las letras del alfabeto. Se usa para deletrear nombres propios, lugares y palabras sin seña específica.'},
      {type:'tip',emoji:'🖐️',title:'Cómo practicar',body:'Coloca tu mano dominante frente a ti, con el dorso hacia el interlocutor. Mantén la muñeca relajada. Cada seña debe ser limpia y estable.'},
      {type:'sign',letter:'A',name:'A',description:'Puño cerrado. Los cuatro dedos doblados sobre la palma. El pulgar al costado del índice, visible.',tip:'La A parece un puño con el pulgar asomando.'},
      {type:'sign',letter:'B',name:'B',description:'Mano plana. Los cuatro dedos juntos y extendidos hacia arriba. El pulgar doblado hacia la palma.',tip:'Piensa en la palma levantada pidiendo "para".'},
      {type:'sign',letter:'C',name:'C',description:'Todos los dedos curvados hacia adentro formando una C. El pulgar también curvado, paralelo a los dedos.',tip:'Literalmente la forma de la letra C vista de frente.'},
      {type:'sign',letter:'D',name:'D',description:'El índice extendido hacia arriba. Los demás dedos curvados tocando el pulgar.',tip:'El índice forma la línea vertical de la D; los otros forman el arco.'},
      {type:'sign',letter:'E',name:'E',description:'Los cuatro dedos doblados hacia abajo en el primer nudillo. El pulgar doblado hacia adentro.',tip:'Imagina que estás agarrando un lápiz muy fino.'},
      {type:'sign',letter:'F',name:'F',description:'El índice doblado toca el pulgar. El anular, medio y meñique extendidos hacia arriba.',tip:'El círculo entre índice y pulgar recuerda la F.'},
      {type:'sign',letter:'G',name:'G',description:'El índice extendido apuntando a un lado. El pulgar también extendido en la misma dirección.',tip:'Ambos dedos apuntan al mismo lado.'},
      {type:'sign',letter:'H',name:'H',description:'El índice y el medio extendidos juntos, apuntando horizontalmente a un lado.',tip:'Dos dedos horizontales = las dos líneas de la H.'},
      {type:'sign',letter:'I',name:'I',description:'Solo el meñique extendido hacia arriba. Los demás dedos cerrados en puño.',tip:'El meñique solo representa el trazo simple de la I.'},
      {type:'sign',letter:'J',name:'J',description:'Como la I (meñique arriba) pero trazas la curva de la J en el aire.',tip:'La J es la única letra con movimiento.'},
      {type:'sign',letter:'K',name:'K',description:'Índice y medio extendidos separados en V. El pulgar extendido hacia fuera.',tip:'Los dos dedos + el pulgar crean los tres trazos de la K.'},
      {type:'sign',letter:'L',name:'L',description:'El índice extendido hacia arriba y el pulgar extendido hacia un lado, formando 90°.',tip:'¡Literalmente la letra L con tu mano!'},
      {type:'sign',letter:'M',name:'M',description:'Los tres dedos del medio doblados sobre el pulgar cerrado.',tip:'Tres dedos sobre el pulgar = tres jorobas de la M.'},
      {type:'quiz',q:'Para deletrear la letra G en LSM:',opts:['Extiendes solo el meñique','Extiendes índice y pulgar apuntando al lado','Formas un círculo con índice y pulgar','Extiendes todos los dedos'],correct:1,feedback:'¡Exacto! La G usa el índice y el pulgar apuntando horizontalmente en la misma dirección.'},
    ]
  },
  {
    order:3, title:'Dactilología N–Z', description:'Completa el abecedario con letras finales y grafemas especiales CH y RR',
    level:'BASICO' as const, duration:20, modules:8, locked:false,
    content: [
      {type:'intro',title:'El abecedario manual LSM (N–Z + CH, RR)',body:'Completamos el abecedario con las letras finales más los grafemas especiales del español: CH y RR.'},
      {type:'sign',letter:'N',name:'N',description:'Dos dedos (índice y medio) doblados sobre el pulgar cerrado.',tip:'Dos dedos sobre el pulgar = dos trazos de la N.'},
      {type:'sign',letter:'O',name:'O',description:'Todos los dedos curvados formando un óvalo cerrado junto con el pulgar.',tip:'La forma del círculo imita la letra O.'},
      {type:'sign',letter:'P',name:'P',description:'El meñique y el índice extendidos apuntando hacia abajo.',tip:'La P es como la Y pero apuntando hacia el suelo.'},
      {type:'sign',letter:'Q',name:'Q',description:'El índice y el pulgar extendidos, apuntando hacia abajo.',tip:'La Q es la G al revés.'},
      {type:'sign',letter:'R',name:'R',description:'El índice y el medio extendidos juntos hacia arriba, pero cruzados.',tip:'Los dedos cruzados recuerdan el trazo diagonal de la R.'},
      {type:'sign',letter:'S',name:'S',description:'Puño cerrado. El pulgar por encima de los dedos.',tip:'Similar a la A pero con el pulgar sobre los dedos.'},
      {type:'sign',letter:'T',name:'T',description:'Puño cerrado. El pulgar asoma entre el índice y el medio.',tip:'El pulgar atrapado entre índice y medio.'},
      {type:'sign',letter:'U',name:'U',description:'El índice y el medio extendidos juntos hacia arriba (sin separarse).',tip:'Dos dedos juntos = las dos líneas paralelas de la U.'},
      {type:'sign',letter:'V',name:'V',description:'El índice y el medio extendidos hacia arriba, separados en V.',tip:'¡El signo de la victoria/paz!'},
      {type:'sign',letter:'W',name:'W',description:'El índice, el medio y el anular extendidos y separados.',tip:'Tres dedos separados = las tres puntas de la W.'},
      {type:'sign',letter:'X',name:'X',description:'El índice ligeramente curvado hacia adentro, como un gancho.',tip:'El dedo enganchado traza el trazo de una X.'},
      {type:'sign',letter:'Y',name:'Y',description:'El meñique y el pulgar extendidos (señal shaka/surfista).',tip:'¡La señal surfista! Los dos dedos externos forman la Y.'},
      {type:'sign',letter:'Z',name:'Z',description:'El índice extendido traza la letra Z en el aire.',tip:'Como la J, la Z tiene movimiento.'},
      {type:'sign',letter:'CH',name:'CH',description:'Primero haces la C, luego con movimiento lateral cambias a la H.',tip:'CH es un dígrafo — en LSM es una seña propia.'},
      {type:'sign',letter:'RR',name:'RR',description:'El índice y el medio extendidos juntos con movimiento vibratorio.',tip:'La vibración representa el sonido "erre" fuerte.'},
      {type:'quiz',q:'¿Qué diferencia hay entre la U y la V en LSM?',opts:['Son idénticas','En U los dedos están juntos; en V están separados','En V los dedos apuntan hacia abajo','No hay diferencia'],correct:1,feedback:'¡Correcto! Ambas usan el índice y el medio, pero en la U están juntos y en la V están separados.'},
    ]
  },
  {
    order:4, title:'Números 1–20', description:'Señas para los números del 1 al 20 en LSM',
    level:'BASICO' as const, duration:15, modules:5, locked:false,
    content: [
      {type:'intro',title:'Los números en LSM',body:'Los números del 1 al 10 en LSM se forman con una sola mano. Son esenciales para expresar edad, hora, precio, cantidad y fechas.'},
      {type:'tip',emoji:'🔢',title:'Orientación de la mano',body:'Para los números, la palma generalmente mira hacia el interlocutor. Los números del 1 al 5 son la base de todo el sistema.'},
      {type:'sign',letter:'1',name:'Uno',description:'Solo el índice extendido hacia arriba. Los demás dedos cerrados.',tip:'¡El clásico número uno!'},
      {type:'sign',letter:'2',name:'Dos',description:'Índice y medio extendidos y juntos. Los demás cerrados.',tip:'Igual que pedir dos cosas con la mano.'},
      {type:'sign',letter:'3',name:'Tres',description:'Pulgar, índice y medio extendidos. El anular y meñique cerrados.',tip:'En LSM el 3 incluye el pulgar.'},
      {type:'sign',letter:'4',name:'Cuatro',description:'Cuatro dedos extendidos juntos. El pulgar doblado hacia la palma.',tip:'Cuatro dedos rectos, pulgar adentro.'},
      {type:'sign',letter:'5',name:'Cinco',description:'Los cinco dedos extendidos y separados (mano abierta).',tip:'Mano completamente abierta = cinco.'},
      {type:'sign',letter:'6',name:'Seis',description:'El pulgar y el meñique extendidos (como la Y).',tip:'Shaka = 6. ¡Fácil de recordar!'},
      {type:'sign',letter:'7',name:'Siete',description:'El pulgar y el anular se tocan. El índice, medio y meñique extendidos.',tip:'Pulgar + anular hacen el círculo. Tres dedos arriba.'},
      {type:'sign',letter:'8',name:'Ocho',description:'El pulgar y el medio se tocan. El índice, anular y meñique extendidos.',tip:'Pulgar + medio cerrados, tres dedos arriba.'},
      {type:'sign',letter:'9',name:'Nueve',description:'El pulgar y el índice se tocan (OK). El medio, anular y meñique extendidos.',tip:'Como el OK pero con más dedos arriba.'},
      {type:'sign',letter:'10',name:'Diez',description:'El puño cerrado con el pulgar arriba (thumbs up), agitado levemente.',tip:'Un "me gusta" con ligero movimiento = 10.'},
      {type:'body',title:'Del 11 al 20',body:'Los números del 11 al 20 se forman mostrando la decena y luego el número restante. En conversación cotidiana muchos usuarios muestran los dígitos en secuencia rápida.'},
      {type:'quiz',q:'¿Cuál es la configuración correcta para el número 6 en LSM?',opts:['Seis dedos (imposible)','Pulgar y meñique extendidos, demás cerrados','Índice y medio extendidos','Puño cerrado con pulgar arriba'],correct:1,feedback:'¡Correcto! El 6 usa pulgar + meñique (la señal "shaka").'},
    ]
  },
  {
    order:5, title:'Saludos y despedidas', description:'Las expresiones básicas de cortesía en LSM',
    level:'BASICO' as const, duration:12, modules:4, locked:false,
    content: [
      {type:'intro',title:'Saludos y despedidas en LSM',body:'Las señas de saludo son las primeras que usarás al interactuar con una persona sorda. El contacto visual es esencial — asegúrate de que tu interlocutor te vea antes de señar.'},
      {type:'tip',emoji:'👁️',title:'Contacto visual',body:'En la Comunidad Sorda el contacto visual es una norma de cortesía fundamental. Nunca empieces a señar si la persona no te está mirando.'},
      {type:'sign',letter:'H',name:'Hola',description:'Mano abierta, palma hacia afuera, agitando de lado a lado frente al cuerpo.',tip:'¡El saludo universal!'},
      {type:'sign',letter:'A',name:'Adiós',description:'Mano abierta con todos los dedos juntos. Se doblan y extienden repetidamente.',tip:'Mismo movimiento que usamos en español.'},
      {type:'sign',letter:'B',name:'Buenos días',description:'Mano plana (palma arriba), movimiento desde abajo hacia arriba (como la salida del sol).',tip:'Imita el sol que sale por el horizonte.'},
      {type:'sign',letter:'C',name:'¿Cómo estás?',description:'Índice y medio de ambas manos se tocan en el pecho y luego se separan. Cejas levantadas.',tip:'¡No olvides levantar las cejas! Sin eso es afirmación, no pregunta.'},
      {type:'sign',letter:'B',name:'Bien',description:'Pulgar extendido hacia arriba (thumbs up). Puede ir con asentimiento.',tip:'¡El thumbs up también funciona en LSM!'},
      {type:'quiz',q:'¿Por qué es importante el contacto visual antes de señar?',opts:['Para que el interlocutor pueda leer tus labios','Porque el receptor debe ver la seña para entenderla','Para mostrar respeto, aunque no es necesario','No es importante'],correct:1,feedback:'¡Correcto! La LSM es un idioma visual. Si la persona sorda no está mirando, simplemente no recibe el mensaje.'},
    ]
  },
  {
    order:6, title:'Presentación personal', description:'Cómo decir tu nombre, edad y lugar de origen en LSM',
    level:'INTERMEDIO' as const, duration:25, modules:6, locked:true,
    content: [
      {type:'intro',title:'Presentarte en LSM',body:'Saber presentarte es el primer paso para una conversación real. Aprenderás a decir tu nombre, edad, ocupación y de dónde eres.'},
      {type:'tip',emoji:'✋',title:'Nombre propio = dactilología',body:'Los nombres propios siempre se deletrean con dactilología la primera vez. Con el tiempo, la comunidad puede asignarte un "nombre-seña" personalizado.'},
      {type:'sign',letter:'N',name:'Mi nombre es…',description:'Primero señas NOMBRE (índice y medio de cada mano se tocan alternadamente). Luego deletreas tu nombre con dactilología.',tip:'Seña NOMBRE + dactilología. Siempre en ese orden.'},
      {type:'sign',letter:'Y',name:'Yo / Mi',description:'El índice apunta hacia tu pecho.',tip:'Apuntar a uno mismo = YO/MI en LSM.'},
      {type:'sign',letter:'E',name:'Estudiante',description:'Mano dominante (como C), se mueve desde la frente hacia adelante.',tip:'La seña representa "sacar conocimiento de la cabeza".'},
      {type:'sign',letter:'M',name:'Mucho gusto',description:'Las dos manos se estrechan suavemente frente al cuerpo con ligera inclinación de cabeza.',tip:'El gesto de apretón de manos también comunica "gusto en conocerte".'},
      {type:'quiz',q:'¿Cómo se dice el nombre propio de alguien en LSM?',opts:['Siempre con una seña específica','Siempre con dactilología (deletreo manual)','Con mímica','No se puede decir nombres propios'],correct:1,feedback:'¡Correcto! Los nombres propios siempre se deletrean con dactilología la primera vez.'},
    ]
  },
  {
    order:7, title:'La familia', description:'Señas para los miembros de la familia y relaciones',
    level:'INTERMEDIO' as const, duration:20, modules:6, locked:true,
    content: [
      {type:'intro',title:'La familia en LSM',body:'En LSM muchas señas de familia se forman combinando una configuración base: las señas masculinas empiezan en la sien/frente, las femeninas en la mejilla.'},
      {type:'tip',emoji:'👨‍👩',title:'Sistema de género en LSM',body:'HOMBRE → zona de la frente/sien. MUJER → zona de la mejilla/mentón. Aprender este patrón te ayuda a inferir señas que no conoces.'},
      {type:'sign',letter:'P',name:'Papá / Padre',description:'Mano con los 5 dedos abiertos y separados tocando la sien.',tip:'Frente = masculino. 5 dedos en sien = PAPÁ.'},
      {type:'sign',letter:'M',name:'Mamá / Madre',description:'Mano con los 5 dedos abiertos tocando la mejilla.',tip:'Mejilla = femenino. 5 dedos en mejilla = MAMÁ.'},
      {type:'sign',letter:'H',name:'Hermano',description:'Primero HOMBRE (pulgar toca la sien), luego IGUAL (dos índices que se unen).',tip:'HOMBRE + IGUAL = hermano.'},
      {type:'sign',letter:'H',name:'Hermana',description:'Primero MUJER (pulgar toca la mejilla), luego IGUAL.',tip:'MUJER + IGUAL = hermana.'},
      {type:'quiz',q:'Según el patrón de género en LSM, ¿dónde se señan las palabras relacionadas con mujeres?',opts:['En la frente/sien','En la mejilla/mentón','En el pecho','En el cuello'],correct:1,feedback:'¡Correcto! La mejilla y mentón se asocian con el género femenino; la frente y sien con el masculino.'},
    ]
  },
  {
    order:8, title:'Emociones y sentimientos', description:'Expresa emociones con expresión facial y señas LSM',
    level:'INTERMEDIO' as const, duration:25, modules:7, locked:true,
    content: [
      {type:'intro',title:'Emociones en LSM',body:'En LSM las emociones se expresan de forma única: la combinación de la seña manual CON la expresión facial es lo que define la emoción.'},
      {type:'tip',emoji:'😊',title:'La expresión facial ES gramática',body:'En LSM la expresión facial no es opcional — es parte integral de la gramática. Practicar frente al espejo es fundamental.'},
      {type:'sign',letter:'F',name:'Feliz / Contento',description:'Mano plana sobre el pecho, movimiento circular hacia afuera y arriba. Expresión facial: sonrisa amplia.',tip:'El movimiento del pecho hacia afuera simboliza el corazón expandiéndose.'},
      {type:'sign',letter:'T',name:'Triste',description:'Ambas manos abiertas se mueven hacia abajo desde los ojos. Expresión: comisuras hacia abajo.',tip:'Las manos imitan las lágrimas descendiendo.'},
      {type:'sign',letter:'E',name:'Enojado',description:'La mano en forma de garra frente a la cara con movimiento tenso hacia afuera. Ceño fruncido.',tip:'La garra tensa representa la tensión interna del enojo.'},
      {type:'sign',letter:'C',name:'Cansado',description:'Ambas manos en V invertida sobre el pecho caen hacia abajo. Los hombros también caen.',tip:'Todo el cuerpo colabora — los hombros hacia abajo refuerzan la seña.'},
      {type:'sign',letter:'A',name:'Amor / Querer',description:'Los brazos cruzados sobre el pecho (como abrazarse a uno mismo).',tip:'¡El abrazo propio universal para expresar amor!'},
      {type:'quiz',q:'Una persona señas FELIZ con expresión facial neutra. ¿Qué comunica?',opts:['Felicidad auténtica','El mensaje es incompleto o incoherente en LSM','Felicidad moderada','Lo mismo que con expresión alegre'],correct:1,feedback:'¡Exacto! En LSM la expresión facial es gramática. Señar FELIZ con cara neutra es gramaticalmente incorrecto.'},
    ]
  },
  {
    order:9, title:'Colores y formas', description:'Vocabulario visual: colores, formas y tamaños en LSM',
    level:'INTERMEDIO' as const, duration:20, modules:5, locked:true,
    content: [
      {type:'intro',title:'Colores en LSM',body:'Los colores en LSM generalmente se indican apuntando a un objeto de ese color o con señas específicas. Muchas señas de colores tienen relación con objetos naturales.'},
      {type:'sign',letter:'R',name:'Rojo',description:'El índice extendido toca y arrastra el labio inferior hacia abajo.',tip:'¡Toca tus labios rojos! La asociación natural hace esta seña fácil.'},
      {type:'sign',letter:'A',name:'Azul',description:'La mano con la letra B se sacude levemente de lado a lado.',tip:'La B de Blue/Azul + movimiento de sacudida.'},
      {type:'sign',letter:'V',name:'Verde',description:'La mano con la letra G se sacude de lado a lado.',tip:'G de Green + sacudida.'},
      {type:'sign',letter:'A',name:'Amarillo',description:'La mano con la letra Y se sacude.',tip:'Y de Yellow + sacudida = amarillo.'},
      {type:'sign',letter:'N',name:'Naranja',description:'La mano en forma de C frente a la boca se cierra repetidamente, imitando exprimir una naranja.',tip:'¡El movimiento de exprimir una naranja!'},
      {type:'body',title:'Formas básicas',body:'Para formas geométricas en LSM se traza la forma en el aire: CÍRCULO, CUADRADO, TRIÁNGULO, RECTÁNGULO. El índice o ambas manos trazan el contorno de la figura.'},
      {type:'quiz',q:'¿Cómo se seña el color ROJO en LSM?',opts:['Trazando una R en el aire','Arrastrando el índice sobre el labio inferior','Apuntando al cielo','Sacudiendo la mano cerrada'],correct:1,feedback:'¡Correcto! La seña de ROJO implica tocar y arrastrar el labio inferior — referencia directa al color natural de los labios.'},
    ]
  },
  {
    order:10, title:'Frases del día a día', description:'Construye oraciones completas con gramática LSM correcta',
    level:'AVANZADO' as const, duration:30, modules:8, locked:true,
    content: [
      {type:'intro',title:'Frases esenciales del día a día',body:'Estas frases te permitirán desenvolverte en situaciones cotidianas. La gramática de LSM coloca típicamente el tiempo al inicio, luego el sujeto, objeto y al final el verbo.'},
      {type:'tip',emoji:'🧠',title:'Gramática LSM básica',body:'El orden de la LSM es diferente al español. Ejemplo: "¿Tú tienes hambre?" en LSM sería: HAMBRE — TÚ (con cejas levantadas).'},
      {type:'sign',letter:'N',name:'No entiendo',description:'La mano (5 dedos abiertos) frente a la frente se sacude de lado a lado. Expresión de confusión.',tip:'¡Esta es la más importante! Úsala sin pena.'},
      {type:'sign',letter:'R',name:'¿Puedes repetirlo?',description:'OTRA VEZ: el índice de la mano dominante da una vuelta circular sobre la palma de la otra mano. Cejas levantadas.',tip:'OTRA VEZ con cejas levantadas = "¿lo repites?".'},
      {type:'sign',letter:'P',name:'Por favor',description:'Mano plana sobre el pecho, movimiento circular en sentido horario.',tip:'El círculo sobre el corazón simboliza la amabilidad.'},
      {type:'sign',letter:'G',name:'Gracias',description:'Mano plana, los dedos tocan la barbilla y se extienden hacia adelante.',tip:'Estás "mandando" tu agradecimiento hacia el otro.'},
      {type:'sign',letter:'D',name:'Disculpa / Lo siento',description:'El puño cerrado rota en el pecho, sobre el corazón. Expresión de arrepentimiento.',tip:'El movimiento circular sobre el corazón expresa contrición.'},
      {type:'sign',letter:'A',name:'Ayuda',description:'El puño cerrado (A) sobre la palma abierta de la otra mano, movimiento de empuje hacia arriba.',tip:'Una mano empujando a la otra hacia arriba = ayudar.'},
      {type:'quiz',q:'En LSM, ¿cuál es el orden gramatical básico de una oración?',opts:['Igual que el español: sujeto-verbo-objeto','Tiempo → Sujeto → Objeto → Verbo','Verbo → Sujeto → Objeto','No hay orden fijo'],correct:1,feedback:'¡Correcto! El orden básico de la LSM pone el tiempo primero, luego el sujeto, el objeto y el verbo al final.'},
    ]
  },
  {
    order:11, title:'Conversación básica', description:'Practica diálogos completos con retroalimentación',
    level:'AVANZADO' as const, duration:35, modules:9, locked:true,
    content: [
      {type:'intro',title:'Tu primera conversación en LSM',body:'Vamos a ensamblar todo lo aprendido en un diálogo completo: saludos, presentación, preguntas básicas y despedida.'},
      {type:'body',title:'El diálogo completo',body:'A: HOLA → B: HOLA + ¿CÓMO ESTÁS? → A: BIEN, GRACIAS + ¿Y TÚ? → B: BIEN TAMBIÉN + NOMBRE TÚ ¿QUÉ? → A: [dactilología de tu nombre] → B: GUSTO MUCHO → A: ¿ESTUDIAR TÚ QUÉ? → B: INGENIERÍA + UTSC → Ambos: ADIÓS'},
      {type:'tip',emoji:'💬',title:'Ritmo de conversación',body:'Los turnos se toman con señas claras: cuando terminas tu turno, bajas las manos. Para tomar el turno, levanta la mano levemente.'},
      {type:'sign',letter:'¿',name:'¿Qué?',description:'El índice hace un movimiento de lado a lado. Cejas levantadas o fruncidas según el tipo de pregunta.',tip:'¿QUÉ? con cejas levantadas = pregunta sí/no. Con ceño fruncido = pregunta de información.'},
      {type:'sign',letter:'Q',name:'¿Quién?',description:'El índice hace pequeños círculos frente al cuerpo. Ceño levemente fruncido.',tip:'Los círculos representan "buscar" a alguien.'},
      {type:'sign',letter:'D',name:'¿Dónde?',description:'El índice apunta hacia abajo y hace pequeños movimientos de lado a lado.',tip:'El movimiento de búsqueda en el espacio = "¿en qué lugar?".'},
      {type:'body',title:'Consejos para tu primera conversación real',body:'1. No finjas entender si no entendiste. 2. Es válido mezclar escritura o teléfono cuando hay dudas. 3. La paciencia es bienvenida. 4. El intento genuino de comunicarte en LSM es muy valorado por la Comunidad Sorda.'},
      {type:'quiz',q:'¿Cómo indicas que es tu turno para señar en LSM?',opts:['Hablando en voz alta','Levantando levemente la mano mientras el otro seña','Aplaudiendo','Golpeando la mesa'],correct:1,feedback:'¡Correcto! En LSM los turnos se toman con gestos visuales: levantas levemente la mano para indicar que quieres el turno.'},
    ]
  },
  {
    order:12, title:'LSM en el campus UTSC', description:'Vocabulario académico para comunicarte en UTSC',
    level:'AVANZADO' as const, duration:30, modules:7, locked:true,
    content: [
      {type:'intro',title:'LSM en el campus de UTSC',body:'Vocabulario específico para comunicarte en el entorno universitario. Estas señas te permitirán interactuar con estudiantes sordos en el salón, cafetería, biblioteca y pasillos.'},
      {type:'sign',letter:'C',name:'Clase / Salón',description:'Las manos en L se colocan paralelas frente al cuerpo y se separan hacia los lados trazando las paredes del salón.',tip:'Trazar las paredes del espacio = definir el lugar.'},
      {type:'sign',letter:'P',name:'Profesor / Maestra',description:'Mano dominante en P, se mueve desde la sien hacia adelante.',tip:'P de Profesor desde la sien (zona del conocimiento).'},
      {type:'sign',letter:'T',name:'Tarea',description:'La mano en forma de T toca la palma de la otra mano varias veces, como escribiendo.',tip:'El gesto de "escribir en la palma" = tarea escrita.'},
      {type:'sign',letter:'E',name:'Examen',description:'Ambas manos hacen el gesto de distribución de papeles hacia adelante.',tip:'La distribución de papeles de examen da origen a esta seña.'},
      {type:'sign',letter:'B',name:'Biblioteca',description:'La letra B hace un movimiento circular sobre la palma de la otra mano (como pasar páginas).',tip:'B de Biblioteca + gesto de leer.'},
      {type:'sign',letter:'C',name:'Cafetería',description:'Seña de COMER (dedos tocan la boca repetidamente) + LUGAR (manos en L trazan un espacio).',tip:'COMER + LUGAR = donde se come = cafetería.'},
      {type:'quiz',q:'¿Cómo se señaría "¿Dónde está la biblioteca?" en LSM?',opts:['DÓNDE + BIBLIOTECA + ESTAR','BIBLIOTECA + DÓNDE (con ceño fruncido)','¿ + BIBLIOTECA + ?','BUSCAR + BIBLIOTECA + YO'],correct:1,feedback:'¡Correcto! En LSM el orden natural es establecer el TEMA primero (BIBLIOTECA) y luego hacer la pregunta (DÓNDE con ceño fruncido).'},
    ]
  },
];

const SIGNS = [
  {letter:'A',name:'A',description:'Puño cerrado, pulgar al costado del índice',category:'Abecedario',level:'BASICO' as const,color:'#0ED2B8',handConfig:{f:[0,0,0,0],t:'side'},tip:'La A parece un puño con el pulgar asomando.'},
  {letter:'B',name:'B',description:'Mano plana, dedos juntos, pulgar doblado',category:'Abecedario',level:'BASICO' as const,color:'#9D7BF8',handConfig:{f:[1,1,1,1],t:'none'},tip:'Palma levantada = PARA/B.'},
  {letter:'C',name:'C',description:'Dedos curvados formando una C con el pulgar',category:'Abecedario',level:'BASICO' as const,color:'#F5A623',handConfig:{f:[0.5,0.5,0.5,0.5],t:'side'},tip:'Literalmente la letra C.'},
  {letter:'D',name:'D',description:'Índice extendido, demás curvados tocando el pulgar',category:'Abecedario',level:'BASICO' as const,color:'#3B82F6',handConfig:{f:[0,0,0,1],t:'side'},tip:'El índice = línea vertical de la D.'},
  {letter:'E',name:'E',description:'Dedos doblados en primer nudillo, pulgar dentro',category:'Abecedario',level:'BASICO' as const,color:'#EC4899',handConfig:{f:[0.3,0.3,0.3,0.3],t:'none'},tip:'Como agarrar un lápiz muy fino.'},
  {letter:'F',name:'F',description:'Anular, medio y meñique arriba; índice toca pulgar',category:'Abecedario',level:'BASICO' as const,color:'#22C97E',handConfig:{f:[1,1,1,0],t:'side'},tip:'El círculo índice-pulgar = F.'},
  {letter:'G',name:'G',description:'Índice apuntando al lado, pulgar extendido',category:'Abecedario',level:'BASICO' as const,color:'#EF4444',handConfig:{f:[0,0,0,1],t:'ext'},tip:'Ambos dedos apuntan al mismo lado.'},
  {letter:'H',name:'H',description:'Índice y medio horizontales juntos',category:'Abecedario',level:'BASICO' as const,color:'#F97316',handConfig:{f:[0,0,1,1],t:'none'},tip:'Dos dedos horizontales = H.'},
  {letter:'I',name:'I',description:'Solo el meñique extendido hacia arriba',category:'Abecedario',level:'BASICO' as const,color:'#0ED2B8',handConfig:{f:[1,0,0,0],t:'none'},tip:'El meñique solo = I.'},
  {letter:'J',name:'J',description:'Meñique extendido, traza J en el aire',category:'Abecedario',level:'BASICO' as const,color:'#9D7BF8',handConfig:{f:[1,0,0,0],t:'none'},tip:'La J tiene movimiento.'},
  {letter:'K',name:'K',description:'Índice y medio en V, pulgar extendido hacia fuera',category:'Abecedario',level:'BASICO' as const,color:'#F5A623',handConfig:{f:[0,0,1,1],t:'ext'},tip:'Tres trazos de la K.'},
  {letter:'L',name:'L',description:'Índice arriba y pulgar extendido formando L',category:'Abecedario',level:'BASICO' as const,color:'#3B82F6',handConfig:{f:[0,0,0,1],t:'ext'},tip:'¡Literalmente la L!'},
  {letter:'M',name:'M',description:'Tres dedos doblados sobre el pulgar cerrado',category:'Abecedario',level:'BASICO' as const,color:'#EC4899',handConfig:{f:[0,0,0,0],t:'none'},tip:'Tres dedos sobre pulgar = tres jorobas de M.'},
  {letter:'N',name:'N',description:'Dos dedos doblados sobre el pulgar cerrado',category:'Abecedario',level:'BASICO' as const,color:'#22C97E',handConfig:{f:[0,0,0,0],t:'none'},tip:'Dos dedos sobre pulgar = N.'},
  {letter:'O',name:'O',description:'Todos los dedos forman una O cerrada con el pulgar',category:'Abecedario',level:'BASICO' as const,color:'#EF4444',handConfig:{f:[0.45,0.45,0.45,0.45],t:'near'},tip:'Círculo = O.'},
  {letter:'P',name:'P',description:'Meñique e índice extendidos apuntando hacia abajo',category:'Abecedario',level:'BASICO' as const,color:'#F97316',handConfig:{f:[1,0,0,1],t:'none'},tip:'La P es la Y hacia abajo.'},
  {letter:'Q',name:'Q',description:'Índice y pulgar apuntando hacia abajo',category:'Abecedario',level:'BASICO' as const,color:'#0ED2B8',handConfig:{f:[0,0,0,1],t:'ext'},tip:'La Q es la G invertida.'},
  {letter:'R',name:'R',description:'Índice y medio cruzados y extendidos',category:'Abecedario',level:'BASICO' as const,color:'#9D7BF8',handConfig:{f:[0,0,1,1],t:'none'},tip:'Dedos cruzados = trazo diagonal de la R.'},
  {letter:'S',name:'S',description:'Puño cerrado, pulgar sobre los dedos',category:'Abecedario',level:'BASICO' as const,color:'#F5A623',handConfig:{f:[0,0,0,0],t:'over'},tip:'Similar a A pero pulgar sobre dedos.'},
  {letter:'T',name:'T',description:'Puño cerrado, pulgar entre índice y medio',category:'Abecedario',level:'BASICO' as const,color:'#3B82F6',handConfig:{f:[0,0,0,0],t:'side'},tip:'Pulgar atrapado entre dos dedos.'},
  {letter:'U',name:'U',description:'Índice y medio juntos extendidos hacia arriba',category:'Abecedario',level:'BASICO' as const,color:'#EC4899',handConfig:{f:[0,0,1,1],t:'none'},tip:'Dos dedos juntos = U.'},
  {letter:'V',name:'V',description:'Índice y medio separados en V (paz)',category:'Abecedario',level:'BASICO' as const,color:'#22C97E',handConfig:{f:[0,0,1,1],t:'none'},tip:'¡El signo de la paz!'},
  {letter:'W',name:'W',description:'Índice, medio y anular extendidos',category:'Abecedario',level:'BASICO' as const,color:'#EF4444',handConfig:{f:[0,1,1,1],t:'none'},tip:'Tres dedos separados = W.'},
  {letter:'X',name:'X',description:'Índice ligeramente curvado/enganchado',category:'Abecedario',level:'BASICO' as const,color:'#F97316',handConfig:{f:[0,0,0,0.45],t:'none'},tip:'Dedo enganchado = X.'},
  {letter:'Y',name:'Y',description:'Meñique y pulgar extendidos (shaka)',category:'Abecedario',level:'BASICO' as const,color:'#0ED2B8',handConfig:{f:[1,0,0,0],t:'ext'},tip:'¡La señal surfista!'},
  {letter:'Z',name:'Z',description:'Índice extendido traza la letra Z en el aire',category:'Abecedario',level:'BASICO' as const,color:'#9D7BF8',handConfig:{f:[0,0,0,1],t:'none'},tip:'Traza las tres líneas en el aire.'},
  {letter:'CH',name:'CH',description:'C con movimiento lateral cambiando a H',category:'Especiales',level:'BASICO' as const,color:'#F5A623',handConfig:{f:[0,0,1,0],t:'ext'},tip:'CH es un dígrafo — seña propia.'},
  {letter:'RR',name:'RR',description:'Índice y medio con vibración repetida',category:'Especiales',level:'BASICO' as const,color:'#3B82F6',handConfig:{f:[0,0,1,1],t:'none'},tip:'La vibración representa el sonido "erre".'},
  {letter:'H',name:'Hola',description:'Mano abierta agitando de lado a lado frente al cuerpo',category:'Saludos',level:'BASICO' as const,color:'#0ED2B8',handConfig:null,tip:'¡El saludo universal!'},
  {letter:'G',name:'Gracias',description:'Mano plana desde la barbilla moviéndose hacia adelante',category:'Saludos',level:'BASICO' as const,color:'#9D7BF8',handConfig:null,tip:'Estás "enviando" tu gratitud.'},
  {letter:'P',name:'Por favor',description:'Mano plana haciendo movimiento circular en el pecho',category:'Saludos',level:'BASICO' as const,color:'#F5A623',handConfig:null,tip:'Círculo sobre el corazón = cortesía.'},
  {letter:'S',name:'Sí',description:'Puño cerrado moviéndose hacia arriba y abajo',category:'Respuestas',level:'BASICO' as const,color:'#22C97E',handConfig:null,tip:'Asentimiento con el puño.'},
  {letter:'N',name:'No',description:'Índice y medio hacen movimiento lateral de negación',category:'Respuestas',level:'BASICO' as const,color:'#EF4444',handConfig:null,tip:'Movimiento lateral = negación.'},
  {letter:'B',name:'Bien / OK',description:'Pulgar extendido hacia arriba con movimiento afirmativo',category:'Respuestas',level:'BASICO' as const,color:'#3B82F6',handConfig:null,tip:'Thumbs up universal.'},
  {letter:'A',name:'Ayuda',description:'Puño cerrado sobre la palma abierta, movimiento hacia arriba',category:'Frases útiles',level:'BASICO' as const,color:'#EC4899',handConfig:null,tip:'Una mano empujando a la otra.'},
];

async function main() {
  console.log('🌱 Seeding database...');

  await prisma.progress.deleteMany();
  await prisma.sign.deleteMany();
  await prisma.lesson.deleteMany();

  for (const lesson of LESSONS) {
    await prisma.lesson.create({ data: lesson });
    console.log(`✅ Lección: ${lesson.title}`);
  }

  for (const sign of SIGNS) {
    await prisma.sign.create({
      data: {
        ...sign,
        handConfig: sign.handConfig ?? Prisma.JsonNull,
      },
    });
  }
  console.log(`✅ ${SIGNS.length} señas insertadas`);

  console.log('✨ Seed completo!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());