// Tipos de la base de datos (supabase/migrations 01–04).
//
// Escritos a mano para arrancar. Cuando cambie el esquema, se pueden
// regenerar con la CLI de Supabase y reemplazar este archivo:
//   npx supabase login
//   npx supabase gen types typescript --project-id <id-del-proyecto> --schema public > src/lib/supabase/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel<FK extends string, Col extends string, Ref extends string> = {
  foreignKeyName: FK;
  columns: [Col];
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: ["id"];
};

export type TipoInspeccion = "salida" | "retorno";
export type ResultadoItem = "ok" | "falla" | "na";
export type EstadoUnidad = "apto" | "requiere_correccion" | "no_apto";
export type TipoUnidad = "refrigerado" | "seco";
export type RolPersonal = "conductor" | "supervisor";
export type EstadoViaje = "en_ruta" | "cerrado" | "cancelado";
export type TipoFirma = "conductor" | "supervisor";
export type DecisionLiberacion = "autorizada_hallazgo_menor" | "corregida_liberada";

export type Database = {
  public: {
    Tables: {
      camiones: {
        Row: {
          id: string;
          numero_unidad: string;
          placa: string;
          tipo: TipoUnidad;
          estado_actual: EstadoUnidad;
          ultimo_km: number | null;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          numero_unidad: string;
          placa: string;
          tipo?: TipoUnidad;
          estado_actual?: EstadoUnidad;
          ultimo_km?: number | null;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["camiones"]["Insert"]>;
        Relationships: [];
      };
      personal: {
        Row: {
          id: string;
          codigo_empleado: string;
          nombre: string;
          rol: RolPersonal;
          email: string | null;
          activo: boolean;
          user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          codigo_empleado: string;
          nombre: string;
          rol: RolPersonal;
          email?: string | null;
          activo?: boolean;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["personal"]["Insert"]>;
        Relationships: [];
      };
      rutas: {
        Row: {
          id: string;
          codigo: string;
          descripcion: string;
          zona: string | null;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          descripcion: string;
          zona?: string | null;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rutas"]["Insert"]>;
        Relationships: [];
      };
      checklist_items: {
        Row: {
          id: string;
          tipo: TipoInspeccion;
          orden: number;
          titulo: string;
          descripcion: string;
          critico: boolean;
          critico_si_refrigerado: boolean;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tipo: TipoInspeccion;
          orden: number;
          titulo: string;
          descripcion: string;
          critico?: boolean;
          critico_si_refrigerado?: boolean;
          activo?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["checklist_items"]["Insert"]>;
        Relationships: [];
      };
      viajes: {
        Row: {
          id: string;
          folio: string;
          camion_id: string;
          conductor_id: string;
          ruta_id: string;
          estado: EstadoViaje;
          km_inicial: number;
          km_final: number | null;
          km_recorridos: number | null;
          salida_at: string;
          retorno_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          folio?: string;
          camion_id: string;
          conductor_id: string;
          ruta_id: string;
          estado?: EstadoViaje;
          km_inicial: number;
          km_final?: number | null;
          salida_at?: string;
          retorno_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["viajes"]["Insert"]>;
        Relationships: [
          Rel<"viajes_camion_id_fkey", "camion_id", "camiones">,
          Rel<"viajes_conductor_id_fkey", "conductor_id", "personal">,
          Rel<"viajes_ruta_id_fkey", "ruta_id", "rutas">,
        ];
      };
      inspecciones: {
        Row: {
          id: string;
          folio: string;
          viaje_id: string;
          tipo: TipoInspeccion;
          camion_id: string;
          conductor_id: string;
          ruta_id: string;
          supervisor_id: string | null;
          kilometraje: number;
          combustible: string | null;
          observaciones: string | null;
          iniciada_at: string;
          finalizada_at: string | null;
          resultado: EstadoUnidad | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        // folio, camion_id, conductor_id y ruta_id los completa un trigger a partir del viaje.
        Insert: {
          id?: string;
          folio?: string;
          viaje_id: string;
          tipo: TipoInspeccion;
          camion_id?: string;
          conductor_id?: string;
          ruta_id?: string;
          supervisor_id?: string | null;
          kilometraje: number;
          combustible?: string | null;
          observaciones?: string | null;
          iniciada_at?: string;
          finalizada_at?: string | null;
          resultado?: EstadoUnidad | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["inspecciones"]["Insert"]>;
        Relationships: [
          Rel<"inspecciones_viaje_id_fkey", "viaje_id", "viajes">,
          Rel<"inspecciones_camion_id_fkey", "camion_id", "camiones">,
          Rel<"inspecciones_conductor_id_fkey", "conductor_id", "personal">,
          Rel<"inspecciones_ruta_id_fkey", "ruta_id", "rutas">,
          Rel<"inspecciones_supervisor_id_fkey", "supervisor_id", "personal">,
        ];
      };
      respuestas_inspeccion: {
        Row: {
          id: string;
          inspeccion_id: string;
          checklist_item_id: string;
          resultado: ResultadoItem;
          comentario: string | null;
          item_titulo: string;
          item_critico: boolean;
          created_at: string;
        };
        // item_titulo e item_critico los completa un trigger.
        Insert: {
          id?: string;
          inspeccion_id: string;
          checklist_item_id: string;
          resultado: ResultadoItem;
          comentario?: string | null;
          item_titulo?: string;
          item_critico?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["respuestas_inspeccion"]["Insert"]>;
        Relationships: [
          Rel<"respuestas_inspeccion_inspeccion_id_fkey", "inspeccion_id", "inspecciones">,
          Rel<"respuestas_inspeccion_checklist_item_id_fkey", "checklist_item_id", "checklist_items">,
        ];
      };
      fotos_hallazgo: {
        Row: { id: string; respuesta_id: string; storage_path: string; created_at: string };
        Insert: { id?: string; respuesta_id: string; storage_path: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["fotos_hallazgo"]["Insert"]>;
        Relationships: [Rel<"fotos_hallazgo_respuesta_id_fkey", "respuesta_id", "respuestas_inspeccion">];
      };
      firmas: {
        Row: {
          id: string;
          inspeccion_id: string;
          tipo: TipoFirma;
          personal_id: string;
          storage_path: string;
          firmado_at: string;
        };
        Insert: {
          id?: string;
          inspeccion_id: string;
          tipo: TipoFirma;
          personal_id: string;
          storage_path: string;
          firmado_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["firmas"]["Insert"]>;
        Relationships: [
          Rel<"firmas_inspeccion_id_fkey", "inspeccion_id", "inspecciones">,
          Rel<"firmas_personal_id_fkey", "personal_id", "personal">,
        ];
      };
      liberaciones: {
        Row: {
          id: string;
          camion_id: string;
          inspeccion_id: string | null;
          estado_anterior: EstadoUnidad;
          decision: DecisionLiberacion;
          responsable_nombre: string;
          responsable_id: string | null;
          accion_tomada: string;
          firma_path: string | null;
          created_at: string;
        };
        // estado_anterior lo completa un trigger; se envía cualquier valor.
        Insert: {
          id?: string;
          camion_id: string;
          inspeccion_id?: string | null;
          estado_anterior: EstadoUnidad;
          decision: DecisionLiberacion;
          responsable_nombre: string;
          responsable_id?: string | null;
          accion_tomada: string;
          firma_path?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["liberaciones"]["Insert"]>;
        Relationships: [
          Rel<"liberaciones_camion_id_fkey", "camion_id", "camiones">,
          Rel<"liberaciones_inspeccion_id_fkey", "inspeccion_id", "inspecciones">,
          Rel<"liberaciones_responsable_id_fkey", "responsable_id", "personal">,
        ];
      };
      destinatarios_correo: {
        Row: {
          id: string;
          email: string;
          nombre: string | null;
          recibe_reportes: boolean;
          recibe_alertas: boolean;
          recibe_resumen: boolean;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          nombre?: string | null;
          recibe_reportes?: boolean;
          recibe_alertas?: boolean;
          recibe_resumen?: boolean;
          activo?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["destinatarios_correo"]["Insert"]>;
        Relationships: [];
      };
      notificaciones_correo: {
        Row: {
          id: string;
          tipo: "reporte_viaje" | "alerta_no_apto" | "resumen_diario";
          viaje_id: string | null;
          inspeccion_id: string | null;
          destinatarios: string[];
          estado: "pendiente" | "enviado" | "error";
          proveedor_id: string | null;
          error: string | null;
          created_at: string;
          enviado_at: string | null;
        };
        Insert: {
          id?: string;
          tipo: "reporte_viaje" | "alerta_no_apto" | "resumen_diario";
          viaje_id?: string | null;
          inspeccion_id?: string | null;
          destinatarios: string[];
          estado?: "pendiente" | "enviado" | "error";
          proveedor_id?: string | null;
          error?: string | null;
          created_at?: string;
          enviado_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["notificaciones_correo"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      v_reporte_inspecciones: {
        Row: {
          id: string;
          folio: string;
          tipo: TipoInspeccion;
          iniciada_at: string;
          finalizada_at: string | null;
          resultado: EstadoUnidad | null;
          kilometraje: number;
          viaje_id: string;
          viaje_folio: string;
          km_recorridos: number | null;
          camion_id: string;
          numero_unidad: string;
          placa: string;
          tipo_unidad: TipoUnidad;
          conductor_id: string;
          conductor: string;
          ruta_id: string;
          ruta_codigo: string;
          ruta: string;
          supervisor: string | null;
          hallazgos: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      finalizar_inspeccion: {
        Args: { p_inspeccion_id: string };
        Returns: EstadoUnidad;
      };
    };
    Enums: {
      tipo_inspeccion: TipoInspeccion;
      resultado_item: ResultadoItem;
      estado_unidad: EstadoUnidad;
      tipo_unidad: TipoUnidad;
      rol_personal: RolPersonal;
      estado_viaje: EstadoViaje;
      tipo_firma: TipoFirma;
      decision_liberacion: DecisionLiberacion;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tabla<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
