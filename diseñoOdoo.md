+--------------------------------------------------------------------------------------------------+

| [Logo Empresa]  Backoffice Corporativo               [Buscador Global]   [Notif] [Perfil Operador]|

+----------------+---------------------------------------------------------------------------------+

|                |  Breadcrumb: Soporte &gt; Tickets Activos &gt; #TK-4092          [Estado: Sync Odoo OK]|

|  MENÚ EMPRESA  +----------------------------------------------------+----------------------------+

|                | [ #TK-4092: Instalación y Mantenimiento Flota ]    | CHATTER / COMUNICACIÓN     |

|  - Dashboard   | Prioridad: ★★★ | Cliente: Logística Andina S.A.    |                            |

|  - Clientes    | Etapa: [Nuevo] -&gt; [En Proceso] -&gt; [Cotizado]       | [ Tab: Cliente ] [Interno] |

|  - Flota / SIM |----------------------------------------------------|----------------------------|

|  &gt; Soporte Odoo| FECHAS Y SLA                                       |                            |

|  - Reportes    | Planeada: [16/10/2026 09:00] | Límite: [18/10 18h] | [Cliente - 10:15 AM]       |

|  - Config      |----------------------------------------------------| "Necesitamos sumar 3       |

|                | [ Tab 1: Tareas (3/5) ]  [ Tab 2: Cotización ($)]  |  unidades más al pedido."  |

|                |----------------------------------------------------|                            |

|                | v [x] 1. Relevamiento inicial (Planeada: 15/10)    | [Nota Interna - 10:22 AM]  |

|                |     |-- [x] 1.1 Verificar cobertura y stock        | "@Carlos ¿tenemos stock    |

|                |     |-- [ ] 1.2 Asignar técnico (Límite: 16/10)    |  disponible para mañana?"  |

|                |                                                    |                            |

|                | v [ ] 2. Armado de presupuesto (Límite: 17/10)     |----------------------------|

|                |                                                    | [Modo: Respuesta Cliente v]|

|                | [+ Agregar Tarea]                                  | [ Escribir mensaje...     ]|

|                |                                                    | [Adjuntar]   [Enviar Msj]  |

+----------------+----------------------------------------------------+----------------------------+  
  
# DISEÑO MOCKUP INTERACTIVO REACT (integrar un modulo similar demo dentro del panel)  
import React, { useState } from 'react';

import { 

  MessageSquare, Lock, Send, Paperclip, Plus, CheckSquare, 

  Square, Calendar, Clock, AlertCircle, FileText, ChevronRight, 

  ChevronDown, User, Building, DollarSign, CheckCircle2, RefreshCw

} from 'lucide-react';

export default function BackofficeOdooEmbed() {

  // Estados para controlar las pestañas y vistas interactivas

  const [activeLeftTab, setActiveLeftTab] = useState&lt;'tasks' | 'quote'&gt;('tasks');

  const [chatMode, setChatMode] = useState&lt;'public' | 'internal'&gt;('public');

  const [ticketStage, setTicketStage] = useState('En Proceso');

  return (

    &lt;div className="flex h-screen w-full bg-slate-900 text-slate-100 font-sans overflow-hidden"&gt;

      

      {/* ==================== 1. SIDEBAR DEL BACKOFFICE EXISTENTE ==================== */}

      &lt;aside className="w-60 bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0"&gt;

        &lt;div&gt;

          &lt;div className="h-16 flex items-center px-6 border-b border-slate-800"&gt;

            &lt;div className="w-3 h-3 rounded-full bg-indigo-500 mr-3"&gt;&lt;/div&gt;

            &lt;span className="font-bold text-lg tracking-wider text-white"&gt;CORE&lt;span className="text-indigo-400"&gt;BACK&lt;/span&gt;&lt;/span&gt;

          &lt;/div&gt;

          &lt;nav className="p-4 space-y-1 text-sm"&gt;

            &lt;a href="#" className="flex items-center px-3 py-2.5 text-slate-400 hover:bg-slate-900 hover:text-white rounded-lg transition"&gt;

              Dashboard General

            &lt;/a&gt;

            &lt;a href="#" className="flex items-center px-3 py-2.5 text-slate-400 hover:bg-slate-900 hover:text-white rounded-lg transition"&gt;

              Directorio de Clientes

            &lt;/a&gt;

            &lt;a href="#" className="flex items-center justify-between px-3 py-2.5 bg-indigo-600/10 text-indigo-400 font-medium border border-indigo-500/20 rounded-lg"&gt;

              &lt;span&gt;Soporte &amp; Operaciones&lt;/span&gt;

              &lt;span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded"&gt;Odoo&lt;/span&gt;

            &lt;/a&gt;

            &lt;a href="#" className="flex items-center px-3 py-2.5 text-slate-400 hover:bg-slate-900 hover:text-white rounded-lg transition"&gt;

              Auditoría y Reportes

            &lt;/a&gt;

          &lt;/nav&gt;

        &lt;/div&gt;

        &lt;div className="p-4 border-t border-slate-800 text-xs text-slate-500 flex items-center justify-between"&gt;

          &lt;span&gt;Odoo RPC Bridge v17&lt;/span&gt;

          &lt;span className="flex items-center text-emerald-400"&gt;&lt;RefreshCw className="w-3 h-3 mr-1 animate-spin" /&gt; Online&lt;/span&gt;

        &lt;/div&gt;

      &lt;/aside&gt;

      {/* ==================== 2. CONTENEDOR PRINCIPAL ==================== */}

      &lt;div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 text-slate-800"&gt;

        

        {/* Topbar del Backoffice */}

        &lt;header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0"&gt;

          &lt;div className="flex items-center space-x-2 text-sm text-slate-500"&gt;

            &lt;span&gt;Operaciones&lt;/span&gt;

            &lt;ChevronRight className="w-4 h-4" /&gt;

            &lt;span&gt;Tickets Odoo&lt;/span&gt;

            &lt;ChevronRight className="w-4 h-4" /&gt;

            &lt;span className="font-semibold text-slate-800"&gt;#TK-4092&lt;/span&gt;

          &lt;/div&gt;

          &lt;div className="flex items-center space-x-4"&gt;

            &lt;span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium flex items-center"&gt;

              &lt;CheckCircle2 className="w-3.5 h-3.5 mr-1" /&gt; Sincronizado con Odoo

            &lt;/span&gt;

            &lt;div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold"&gt;

              OP

            &lt;/div&gt;

          &lt;/div&gt;

        &lt;/header&gt;

        {/* ==================== 3. WORKSPACE ODOO EMBEBIDO (SPLIT VIEW) ==================== */}

        &lt;div className="flex-1 flex overflow-hidden"&gt;

          

          {/* ---------- PANEL IZQUIERDO: GESTIÓN DEL TICKET, TAREAS Y COTIZACIÓN ---------- */}

          &lt;div className="flex-1 flex flex-col overflow-y-auto border-r border-slate-200 bg-white"&gt;

            

            {/* Cabecera del Ticket + Pipeline de Etapas */}

            &lt;div className="p-6 border-b border-slate-200"&gt;

              &lt;div className="flex items-center justify-between mb-3"&gt;

                &lt;span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded"&gt;

                  helpdesk.ticket #4092

                &lt;/span&gt;

                {/* Selector de Etapas estilo Odoo */}

                &lt;div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs font-medium"&gt;

                  {['Nuevo', 'En Proceso', 'Cotizado', 'Resuelto'].map((stage) =&gt; (

                    &lt;button

                      key={stage}

                      onClick={() =&gt; setTicketStage(stage)}

                      className={`px-3 py-1.5 transition ${

                        ticketStage === stage 

                          ? 'bg-indigo-600 text-white' 

                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'

                      }`}

                    &gt;

                      {stage}

                    &lt;/button&gt;

                  ))}

                &lt;/div&gt;

              &lt;/div&gt;

              &lt;h1 className="text-xl font-bold text-slate-900 mb-4"&gt;

                Instalación de equipos de telemetría y alta de unidades (x8)

              &lt;/h1&gt;

              {/* Metadatos y Fechas Críticas */}

              &lt;div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs"&gt;

                &lt;div&gt;

                  &lt;span className="text-slate-400 block mb-1"&gt;Cliente Asociado&lt;/span&gt;

                  &lt;div className="font-semibold text-slate-700 flex items-center"&gt;

                    &lt;Building className="w-3.5 h-3.5 mr-1.5 text-slate-400" /&gt; Logística Andina S.A.

                  &lt;/div&gt;

                &lt;/div&gt;

                &lt;div&gt;

                  &lt;span className="text-slate-400 block mb-1"&gt;Responsable&lt;/span&gt;

                  &lt;div className="font-semibold text-slate-700 flex items-center"&gt;

                    &lt;User className="w-3.5 h-3.5 mr-1.5 text-slate-400" /&gt; Sofía Méndez

                  &lt;/div&gt;

                &lt;/div&gt;

                &lt;div&gt;

                  &lt;span className="text-slate-400 block mb-1"&gt;Fecha Planeada&lt;/span&gt;

                  &lt;div className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded inline-flex items-center border border-blue-200"&gt;

                    &lt;Calendar className="w-3.5 h-3.5 mr-1.5" /&gt; 16 Oct 2026, 09:00

                  &lt;/div&gt;

                &lt;/div&gt;

                &lt;div&gt;

                  &lt;span className="text-slate-400 block mb-1"&gt;Fecha Límite (SLA)&lt;/span&gt;

                  &lt;div className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded inline-flex items-center border border-amber-200"&gt;

                    &lt;AlertCircle className="w-3.5 h-3.5 mr-1.5" /&gt; 18 Oct 2026, 18:00

                  &lt;/div&gt;

                &lt;/div&gt;

              &lt;/div&gt;

            &lt;/div&gt;

            {/* Navegación de Pestañas Operativas */}

            &lt;div className="px-6 border-b border-slate-200 flex space-x-6 text-sm font-medium bg-slate-50/50"&gt;

              &lt;button

                onClick={() =&gt; setActiveLeftTab('tasks')}

                className={`py-3.5 border-b-2 flex items-center space-x-2 transition ${

                  activeLeftTab === 'tasks'

                    ? 'border-indigo-600 text-indigo-600'

                    : 'border-transparent text-slate-500 hover:text-slate-800'

                }`}

              &gt;

                &lt;CheckSquare className="w-4 h-4" /&gt;

                &lt;span&gt;Tareas y Subtareas&lt;/span&gt;

                &lt;span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full"&gt;2/4&lt;/span&gt;

              &lt;/button&gt;

              &lt;button

                onClick={() =&gt; setActiveLeftTab('quote')}

                className={`py-3.5 border-b-2 flex items-center space-x-2 transition ${

                  activeLeftTab === 'quote'

                    ? 'border-indigo-600 text-indigo-600'

                    : 'border-transparent text-slate-500 hover:text-slate-800'

                }`}

              &gt;

                &lt;FileText className="w-4 h-4" /&gt;

                &lt;span&gt;Cotización Asociada&lt;/span&gt;

                &lt;span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-semibold"&gt;

                  S00412 - $1,420.00

                &lt;/span&gt;

              &lt;/button&gt;

            &lt;/div&gt;

            {/* Contenido Dinámico de las Pestañas */}

            &lt;div className="p-6 flex-1"&gt;

              {activeLeftTab === 'tasks' ? (

                /* --- VISTA 1: TAREAS Y SUBTAREAS CON FECHAS --- */

                &lt;div className="space-y-4"&gt;

                  &lt;div className="flex items-center justify-between mb-2"&gt;

                    &lt;h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider"&gt;

                      Planificación Operativa (project.task)

                    &lt;/h3&gt;

                    &lt;button className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-semibold px-3 py-1.5 rounded-lg flex items-center transition"&gt;

                      &lt;Plus className="w-3.5 h-3.5 mr-1" /&gt; Nueva Tarea Principal

                    &lt;/button&gt;

                  &lt;/div&gt;

                  {/* Tarea Padre 1 */}

                  &lt;div className="border border-slate-200 rounded-xl overflow-hidden"&gt;

                    &lt;div className="bg-slate-50 p-3.5 flex items-center justify-between border-b border-slate-200"&gt;

                      &lt;div className="flex items-center space-x-2.5"&gt;

                        &lt;ChevronDown className="w-4 h-4 text-slate-400 cursor-pointer" /&gt;

                        &lt;CheckSquare className="w-4 h-4 text-indigo-600 cursor-pointer" /&gt;

                        &lt;span className="font-semibold text-sm text-slate-800"&gt;1. Relevamiento técnico y preparación de equipos&lt;/span&gt;

                      &lt;/div&gt;

                      &lt;div className="flex items-center space-x-3 text-xs"&gt;

                        &lt;span className="text-slate-500 flex items-center"&gt;

                          &lt;Clock className="w-3.5 h-3.5 mr-1 text-blue-500" /&gt; Planeada: 15 Oct

                        &lt;/span&gt;

                        &lt;span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-medium"&gt;En curso&lt;/span&gt;

                      &lt;/div&gt;

                    &lt;/div&gt;

                    {/* Subtareas de Tarea 1 */}

                    &lt;div className="divide-y divide-slate-100 bg-white pl-8 pr-4"&gt;

                      &lt;div className="py-3 flex items-center justify-between text-sm"&gt;

                        &lt;div className="flex items-center space-x-2.5"&gt;

                          &lt;CheckSquare className="w-4 h-4 text-emerald-500 cursor-pointer" /&gt;

                          &lt;span className="line-through text-slate-400"&gt;1.1 Validar disponibilidad de módulos GPS y SIMs&lt;/span&gt;

                        &lt;/div&gt;

                        &lt;div className="flex items-center space-x-4 text-xs"&gt;

                          &lt;span className="text-slate-400"&gt;Completado: 15 Oct&lt;/span&gt;

                          &lt;span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold"&gt;CM&lt;/span&gt;

                        &lt;/div&gt;

                      &lt;/div&gt;

                      &lt;div className="py-3 flex items-center justify-between text-sm"&gt;

                        &lt;div className="flex items-center space-x-2.5"&gt;

                          &lt;Square className="w-4 h-4 text-slate-300 cursor-pointer hover:text-indigo-500" /&gt;

                          &lt;span className="text-slate-700 font-medium"&gt;1.2 Programar firmware y asociar en plataforma&lt;/span&gt;

                        &lt;/div&gt;

                        &lt;div className="flex items-center space-x-4 text-xs"&gt;

                          &lt;span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded"&gt;Planeada: 16 Oct 10:00&lt;/span&gt;

                          &lt;span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-medium"&gt;Límite: 16 Oct 18:00&lt;/span&gt;

                          &lt;span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold"&gt;SM&lt;/span&gt;

                        &lt;/div&gt;

                      &lt;/div&gt;

                    &lt;/div&gt;

                  &lt;/div&gt;

                  {/* Tarea Padre 2 */}

                  &lt;div className="border border-slate-200 rounded-xl overflow-hidden"&gt;

                    &lt;div className="bg-slate-50 p-3.5 flex items-center justify-between"&gt;

                      &lt;div className="flex items-center space-x-2.5"&gt;

                        &lt;ChevronRight className="w-4 h-4 text-slate-400 cursor-pointer" /&gt;

                        &lt;Square className="w-4 h-4 text-slate-300 cursor-pointer" /&gt;

                        &lt;span className="font-semibold text-sm text-slate-800"&gt;2. Coordinación e instalación en base del cliente&lt;/span&gt;

                      &lt;/div&gt;

                      &lt;div className="flex items-center space-x-3 text-xs"&gt;

                        &lt;span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded"&gt;Planeada: 17 Oct&lt;/span&gt;

                        &lt;span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium"&gt;Límite: 18 Oct&lt;/span&gt;

                        &lt;span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-medium"&gt;Pendiente&lt;/span&gt;

                      &lt;/div&gt;

                    &lt;/div&gt;

                  &lt;/div&gt;

                &lt;/div&gt;

              ) : (

                /* --- VISTA 2: ARMADO DE COTIZACIÓN (SALE.ORDER) --- */

                &lt;div className="space-y-4"&gt;

                  &lt;div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-100 p-4 rounded-xl"&gt;

                    &lt;div&gt;

                      &lt;span className="text-xs font-bold text-indigo-600 uppercase"&gt;Orden de Venta Odoo #S00412&lt;/span&gt;

                      &lt;p className="text-xs text-slate-500 mt-0.5"&gt;Vinculada directamente al ticket #TK-4092 • Validez: 30 Oct 2026&lt;/p&gt;

                    &lt;/div&gt;

                    &lt;div className="flex space-x-2"&gt;

                      &lt;button className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"&gt;

                        Vista Previa PDF

                      &lt;/button&gt;

                      &lt;button className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"&gt;

                        &lt;Send className="w-3.5 h-3.5 mr-1.5" /&gt; Enviar al Chat del Cliente

                      &lt;/button&gt;

                    &lt;/div&gt;

                  &lt;/div&gt;

                  {/* Tabla de Líneas de Cotización */}

                  &lt;div className="border border-slate-200 rounded-xl overflow-hidden"&gt;

                    &lt;table className="w-full text-left border-collapse text-sm"&gt;

                      &lt;thead&gt;

                        &lt;tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase"&gt;

                          &lt;th className="py-2.5 px-4"&gt;Producto / Servicio&lt;/th&gt;

                          &lt;th className="py-2.5 px-3 text-center"&gt;Cant.&lt;/th&gt;

                          &lt;th className="py-2.5 px-3 text-right"&gt;Precio Unit.&lt;/th&gt;

                          &lt;th className="py-2.5 px-3 text-right"&gt;Impuestos&lt;/th&gt;

                          &lt;th className="py-2.5 px-4 text-right"&gt;Subtotal&lt;/th&gt;

                        &lt;/tr&gt;

                      &lt;/thead&gt;

                      &lt;tbody className="divide-y divide-slate-200 text-slate-700"&gt;

                        &lt;tr&gt;

                          &lt;td className="py-3 px-4"&gt;

                            &lt;p className="font-semibold text-slate-800"&gt;[MOD-GPS-4G] Módulo Telemetría Avanzada&lt;/p&gt;

                            &lt;p className="text-xs text-slate-400"&gt;Incluye arnés y sensor de ignición&lt;/p&gt;

                          &lt;/td&gt;

                          &lt;td className="py-3 px-3 text-center font-medium"&gt;8&lt;/td&gt;

                          &lt;td className="py-3 px-3 text-right"&gt;$120.00&lt;/td&gt;

                          &lt;td className="py-3 px-3 text-right text-xs text-slate-500"&gt;IVA 21%&lt;/td&gt;

                          &lt;td className="py-3 px-4 text-right font-semibold"&gt;$960.00&lt;/td&gt;

                        &lt;/tr&gt;

                        &lt;tr&gt;

                          &lt;td className="py-3 px-4"&gt;

                            &lt;p className="font-semibold text-slate-800"&gt;[SRV-INST] Mano de Obra Instalación en Campo&lt;/p&gt;

                            &lt;p className="text-xs text-slate-400"&gt;Técnico certificado a domicilio&lt;/p&gt;

                          &lt;/td&gt;

                          &lt;td className="py-3 px-3 text-center font-medium"&gt;8&lt;/td&gt;

                          &lt;td className="py-3 px-3 text-right"&gt;$45.00&lt;/td&gt;

                          &lt;td className="py-3 px-3 text-right text-xs text-slate-500"&gt;IVA 21%&lt;/td&gt;

                          &lt;td className="py-3 px-4 text-right font-semibold"&gt;$360.00&lt;/td&gt;

                        &lt;/tr&gt;

                        &lt;tr&gt;

                          &lt;td className="py-3 px-4"&gt;

                            &lt;p className="font-semibold text-slate-800"&gt;[ABONO-M2M] Plan Conectividad Multi-operador&lt;/p&gt;

                            &lt;p className="text-xs text-slate-400"&gt;Abono mensual por unidad&lt;/p&gt;

                          &lt;/td&gt;

                          &lt;td className="py-3 px-3 text-center font-medium"&gt;8&lt;/td&gt;

                          &lt;td className="py-3 px-3 text-right"&gt;$12.50&lt;/td&gt;

                          &lt;td className="py-3 px-3 text-right text-xs text-slate-500"&gt;IVA 21%&lt;/td&gt;

                          &lt;td className="py-3 px-4 text-right font-semibold"&gt;$100.00&lt;/td&gt;

                        &lt;/tr&gt;

                      &lt;/tbody&gt;

                    &lt;/table&gt;

                    &lt;div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between"&gt;

                      &lt;button className="text-xs text-indigo-600 font-semibold flex items-center hover:underline"&gt;

                        &lt;Plus className="w-3.5 h-3.5 mr-1" /&gt; Agregar línea de producto

                      &lt;/button&gt;

                      &lt;div className="text-right"&gt;

                        &lt;span className="text-xs text-slate-500 mr-3"&gt;Total Cotizado (Sin Imp.):&lt;/span&gt;

                        &lt;span className="text-base font-bold text-slate-900"&gt;$1,420.00&lt;/span&gt;

                      &lt;/div&gt;

                    &lt;/div&gt;

                  &lt;/div&gt;

                &lt;/div&gt;

              )}

            &lt;/div&gt;

          &lt;/div&gt;

          {/* ---------- PANEL DERECHO: CHATTER DUAL (CLIENTE VS INTERNO) ---------- */}

          &lt;div className="w-[420px] flex flex-col bg-slate-50 shrink-0"&gt;

            

            {/* Selector Superior de Canal de Comunicación */}

            &lt;div className="p-3 bg-white border-b border-slate-200"&gt;

              &lt;div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold"&gt;

                &lt;button

                  onClick={() =&gt; setChatMode('public')}

                  className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition ${

                    chatMode === 'public'

                      ? 'bg-white text-indigo-600 shadow-sm'

                      : 'text-slate-600 hover:text-slate-900'

                  }`}

                &gt;

                  &lt;MessageSquare className="w-3.5 h-3.5" /&gt;

                  &lt;span&gt;Chat con Cliente&lt;/span&gt;

                &lt;/button&gt;

                &lt;button

                  onClick={() =&gt; setChatMode('internal')}

                  className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition ${

                    chatMode === 'internal'

                      ? 'bg-amber-500 text-white shadow-sm'

                      : 'text-slate-600 hover:text-slate-900'

                  }`}

                &gt;

                  &lt;Lock className="w-3.5 h-3.5" /&gt;

                  &lt;span&gt;Notas Internas (Equipo)&lt;/span&gt;

                &lt;/button&gt;

              &lt;/div&gt;

            &lt;/div&gt;

            {/* Historial de Mensajes Unificado con Distinción Visual */}

            &lt;div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs"&gt;

              

              {/* Mensaje del Cliente */}

              &lt;div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm"&gt;

                &lt;div className="flex items-center justify-between mb-1.5"&gt;

                  &lt;span className="font-bold text-slate-800 flex items-center"&gt;

                    &lt;span className="w-2 h-2 rounded-full bg-indigo-500 mr-2"&gt;&lt;/span&gt;

                    Martín Gómez (Cliente)

                  &lt;/span&gt;

                  &lt;span className="text-[11px] text-slate-400"&gt;Hoy, 09:40&lt;/span&gt;

                &lt;/div&gt;

                &lt;p className="text-slate-600 leading-relaxed"&gt;

                  Hola equipo, además de las 5 unidades originales, necesitamos sumar 3 camionetas más al presupuesto y confirmar si pueden instalar todo antes del domingo 18.

                &lt;/p&gt;

              &lt;/div&gt;

              {/* Nota Interna del Equipo (Fondo Ámbar estilo Odoo Note) */}

              &lt;div className="bg-amber-50/90 p-3.5 rounded-xl border border-amber-200/80"&gt;

                &lt;div className="flex items-center justify-between mb-1.5"&gt;

                  &lt;span className="font-bold text-amber-900 flex items-center"&gt;

                    &lt;Lock className="w-3 h-3 text-amber-600 mr-1.5" /&gt;

                    Carlos Ruiz (Logística) • &lt;span className="text-[10px] uppercase ml-1 bg-amber-200/70 px-1.5 py-0.5 rounded"&gt;Nota Interna&lt;/span&gt;

                  &lt;/span&gt;

                  &lt;span className="text-[11px] text-amber-700/70"&gt;Hoy, 10:05&lt;/span&gt;

                &lt;/div&gt;

                &lt;p className="text-amber-900/90 leading-relaxed"&gt;

                  &lt;span className="font-semibold text-amber-950"&gt;@Sofía Méndez&lt;/span&gt; ya verifiqué en pañol y tenemos los 8 kits listos. Actualizá la cotización &lt;span className="underline font-medium"&gt;#S00412&lt;/span&gt; a 8 unidades y pasale el link de aprobación.

                &lt;/p&gt;

              &lt;/div&gt;

              {/* Respuesta Pública del Operador */}

              &lt;div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100 ml-4"&gt;

                &lt;div className="flex items-center justify-between mb-1.5"&gt;

                  &lt;span className="font-bold text-indigo-950"&gt;Sofía Méndez (Soporte)&lt;/span&gt;

                  &lt;span className="text-[11px] text-indigo-400"&gt;Hoy, 10:18&lt;/span&gt;

                &lt;/div&gt;

                &lt;p className="text-slate-700 leading-relaxed"&gt;

                  ¡Hola Martín! Perfecto, ya actualicé la cotización &lt;span className="font-semibold text-indigo-600"&gt;#S00412&lt;/span&gt; por las 8 unidades totales y agendamos la visita técnica para el viernes 16 a las 09:00 hs.

                &lt;/p&gt;

              &lt;/div&gt;

            &lt;/div&gt;

            {/* Compositor de Mensajes con Guardarraíl Visual */}

            &lt;div className={`p-3 border-t transition-colors ${

              chatMode === 'public' 

                ? 'bg-white border-slate-200' 

                : 'bg-amber-50/70 border-amber-200'

            }`}&gt;

              &lt;div className="flex items-center justify-between mb-2 text-[11px]"&gt;

                {chatMode === 'public' ? (

                  &lt;span className="text-indigo-600 font-semibold flex items-center"&gt;

                    &lt;MessageSquare className="w-3 h-3 mr-1" /&gt;

                    Respondiendo al cliente (enviará correo y actualizará portal)

                  &lt;/span&gt;

                ) : (

                  &lt;span className="text-amber-800 font-semibold flex items-center"&gt;

                    &lt;Lock className="w-3 h-3 mr-1" /&gt;

                    Modo Nota Interna (invisible para el cliente, permite @menciones)

                  &lt;/span&gt;

                )}

              &lt;/div&gt;

              &lt;textarea

                rows={3}

                placeholder={

                  chatMode === 'public'

                    ? 'Escribe una respuesta para el cliente o inserta la cotización...'

                    : 'Escribe una nota privada para el equipo técnico o comercial...'

                }

                className={`w-full rounded-lg p-2.5 text-xs focus:outline-none border resize-none ${

                  chatMode === 'public'

                    ? 'bg-slate-50 border-slate-200 focus:border-indigo-500 text-slate-800'

                    : 'bg-white border-amber-300 focus:border-amber-500 text-slate-800'

                }`}

              /&gt;

              &lt;div className="flex items-center justify-between mt-2"&gt;

                &lt;div className="flex space-x-1"&gt;

                  &lt;button className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg" title="Adjuntar archivo"&gt;

                    &lt;Paperclip className="w-4 h-4" /&gt;

                  &lt;/button&gt;

                  &lt;button 

                    onClick={() =&gt; setActiveLeftTab('quote')}

                    className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex items-center"

                  &gt;

                    &lt;DollarSign className="w-3.5 h-3.5 mr-0.5 text-emerald-600" /&gt; Insertar Cotización

                  &lt;/button&gt;

                &lt;/div&gt;

                &lt;button

                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center shadow-sm transition ${

                    chatMode === 'public'

                      ? 'bg-indigo-600 hover:bg-indigo-700'

                      : 'bg-amber-600 hover:bg-amber-700'

                  }`}

                &gt;

                  &lt;Send className="w-3.5 h-3.5 mr-1.5" /&gt;

                  {chatMode === 'public' ? 'Enviar al Cliente' : 'Guardar Nota Interna'}

                &lt;/button&gt;

              &lt;/div&gt;

            &lt;/div&gt;

          &lt;/div&gt;

        &lt;/div&gt;

      &lt;/div&gt;

    &lt;/div&gt;

  );

}  
