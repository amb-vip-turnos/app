import { db } from './firebase-config.js';
import { collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const formulario = document.getElementById('turnoForm'); 
const loadingOverlay = document.getElementById('loadingOverlay');
const fechaInput = document.getElementById('fecha');
const horaSelect = document.getElementById('hora');
const servicioSelect = document.getElementById('servicio');
const barberoInput = document.getElementById('barberoInput');

// >>> CAMBIO: Intervalo actualizado a 60 minutos (1 hora) <<<
const CONFIG = { apertura: 9, cierre: 21, intervalo: 60 };

const SERVICIOS_SEBA = [
    { nombre: "Corte Moderno (Barba/Cejas)", precio: "$12.000", disponible: true },
    { nombre: "Corte Moderno (Lavado/Nutrición)", precio: "$13.000", disponible: false },
    { nombre: "Corte Moderno (Lavado/Mascarilla)", precio: "$15.000", disponible: true },
    { nombre: "Color Moderno (Claritos/Mechas)", precio: "$35.000", disponible: false },
    { nombre: "Color Global", precio: "$50.000", disponible: false },
    { nombre: "Permanente / Ondulación", precio: "$45.000", disponible: false }
];

const hoy = new Date();
const anio = hoy.getFullYear();
const mes = String(hoy.getMonth() + 1).padStart(2, '0');
const dia = String(hoy.getDate()).padStart(2, '0');
const fechaHoyStr = `${anio}-${mes}-${dia}`;
fechaInput.min = fechaHoyStr;

function inicializarServicios() {
    servicioSelect.innerHTML = '<option value="" disabled selected>Elegí un servicio</option>';
    SERVICIOS_SEBA.forEach(servicio => {
        let opt = document.createElement('option');
        opt.value = servicio.nombre;
        if (servicio.disponible) {
            opt.textContent = `${servicio.nombre} — ${servicio.precio}`;
        } else {
            opt.textContent = `${servicio.nombre} — (No disponible)`;
            opt.disabled = true;
            opt.style.color = "#888";
        }
        servicioSelect.appendChild(opt);
    });
}
inicializarServicios();

async function cargarHorariosDisponibles() {
    const fecha = fechaInput.value;
    const barberoSeleccionado = barberoInput.value; 
    if (!fecha) return;

    const fechaObj = new Date(fecha + 'T00:00:00');
    if (fechaObj.getDay() === 0) {
        horaSelect.innerHTML = '<option value="" disabled selected>Cerrado los Domingos</option>';
        horaSelect.disabled = true;
        return;
    }

    horaSelect.innerHTML = '<option>Consultando disponibilidad...</option>';
    horaSelect.disabled = true;
    
    try {
        const q = query(collection(db, "turnos"), 
                  where("fecha", "==", fecha), 
                  where("barbero", "==", barberoSeleccionado));
        
        const snapshot = await getDocs(q);
        const ocupados = snapshot.docs.map(doc => doc.data().hora);

        horaSelect.innerHTML = '<option value="" disabled selected>Elegí una hora</option>';
        
        const ahora = new Date();
        const esHoy = (fecha === fechaHoyStr);
        const horaActual = ahora.getHours();
        const minutoActual = ahora.getMinutes();

        let horariosDisponibles = 0;

        // >>> CAMBIO: Generación de horarios cada 1 hora <<<
        for (let h = CONFIG.apertura; h <= CONFIG.cierre; h++) {
            // Solo generamos los minutos que coincidan con el intervalo (en este caso 00)
            for (let m = 0; m < 60; m += CONFIG.intervalo) {
                let slot = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                
                let yaPaso = false;
                if (esHoy) {
                    // Si es hoy, comparamos con la hora actual para no dar turnos viejos
                    if (h < horaActual || (h === horaActual && m <= minutoActual)) {
                        yaPaso = true;
                    }
                }

                if (!ocupados.includes(slot) && !yaPaso) {
                    let opt = document.createElement('option');
                    opt.value = slot;
                    opt.textContent = `${slot} hs`;
                    horaSelect.appendChild(opt);
                    horariosDisponibles++;
                }
            }
        }

        if (horariosDisponibles === 0) {
            horaSelect.innerHTML = '<option value="" disabled selected>No quedan turnos</option>';
            horaSelect.disabled = true;
        } else {
            horaSelect.disabled = false;
        }

    } catch (e) { 
        console.error(e);
        horaSelect.innerHTML = '<option>Error al cargar</option>';
    }
}

fechaInput.addEventListener('change', cargarHorariosDisponibles);

formulario.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('nombre').value.trim();
    const whatsapp = document.getElementById('whatsapp').value.trim();
    const servicioNombre = servicioSelect.value; 
    const fecha = fechaInput.value;
    const hora = horaSelect.value;
    const barbero = barberoInput.value;

    const servicioInfo = SERVICIOS_SEBA.find(s => s.nombre === servicioNombre);
    const precioFinal = servicioInfo ? servicioInfo.precio : "A convenir";

    if (!nombre || !whatsapp || !servicioNombre || !fecha || !hora) {
        alert("⚠️ Por favor, completa todos los campos.");
        return;
    }

    try {
        loadingOverlay.style.display = 'flex';

        await addDoc(collection(db, "turnos"), {
            nombre,
            whatsapp,
            barbero,
            servicio: servicioNombre,
            precio: precioFinal,
            fecha,
            hora,
            creadoEn: new Date()
        });
        
        const numeroBarberia = "5492643212176"; 
        
        const mensaje = `Hola *AMB VIP*, hay un NUEVO TURNO reservado:%0A%0A` +
                        `👤 *Cliente:* ${nombre}%0A` +
                        `✂️ *Servicio:* ${servicioNombre}%0A` +
                        `💰 *Precio:* ${precioFinal}%0A` +
                        `📅 *Fecha:* ${fecha}%0A` +
                        `⏰ *Hora:* ${hora} hs%0A%0A` +
                        `_Confirmar disponibilidad en el panel._`;

        loadingOverlay.style.display = 'none';
        document.getElementById('modal-exito').style.display = 'flex';
        
        setTimeout(() => {
            window.location.href = `https://wa.me/${numeroBarberia}?text=${mensaje}`;
        }, 1500);

    } catch (error) {
        loadingOverlay.style.display = 'none';
        alert("Error al reservar. Intentá de nuevo.");
        console.error(error);
    }
});