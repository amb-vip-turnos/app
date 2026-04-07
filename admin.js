import { db } from './firebase-config.js';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, addDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- MEJORA DE SONIDO ---
const sonidoTurno = new Audio('notificacion.mp3');
let primeraCarga = true; 
// ------------------------

// >>> LÓGICA DE FILTRADO CON HISTORIAL (Mantenida intacta) <<<
window.filtrarVista = (tipo) => {
    document.getElementById('btn-ver-turnos').classList.toggle('activo', tipo === 'turnos');
    document.getElementById('btn-ver-bloqueos').classList.toggle('activo', tipo === 'bloqueos');
    
    const btnHistorial = document.getElementById('btn-ver-historial');
    if (btnHistorial) btnHistorial.classList.toggle('activo', tipo === 'historial');

    const hoyStr = new Date().toISOString().split('T')[0];
    const filas = document.querySelectorAll('#tabla-turnos tr');

    filas.forEach(fila => {
        const estado = fila.getAttribute('data-estado');
        const fecha = fila.getAttribute('data-fecha');
        const esBloqueado = estado === 'bloqueado';
        const esCompletado = estado === 'completado';
        const esPasado = fecha < hoyStr;

        fila.style.display = 'none';

        if (tipo === 'turnos') {
            if (!esBloqueado && !esCompletado && !esPasado) fila.style.display = '';
        } else if (tipo === 'bloqueos') {
            if (esBloqueado && !esPasado) fila.style.display = '';
        } else if (tipo === 'historial') {
            if ((esPasado || esCompletado) && !esBloqueado) fila.style.display = '';
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    
    // PARCHE IPHONE AUDIO (Mantenido intacto)
    document.body.addEventListener('click', () => {
        sonidoTurno.play().then(() => {
            sonidoTurno.pause();
            sonidoTurno.currentTime = 0;
        }).catch(e => console.log("Audio preparado para iPhone"));
    }, { once: true });

    const tablaBody = document.getElementById('tabla-turnos');
    if (!tablaBody) return;

    const hoy = new Date();
    const fechaHoy = hoy.toISOString().split('T')[0]; 

    const horaInicio = document.getElementById('horaInicio');
    const horaFin = document.getElementById('horaFin');
    
    // >>> AJUSTE 1: Selectores de bloqueo ahora de 1 en 1 hora (9 a 21) <<<
    if (horaInicio && horaFin) {
        horaInicio.innerHTML = '<option value="" disabled selected>Desde</option>';
        horaFin.innerHTML = '<option value="" disabled selected>Hasta</option>';
        for (let h = 9; h <= 21; h++) {
            let hora = `${h.toString().padStart(2, '0')}:00`;
            horaInicio.innerHTML += `<option value="${hora}">${hora}</option>`;
            horaFin.innerHTML += `<option value="${hora}">${hora}</option>`;
        }
    }

    const btnBloquear = document.getElementById('btnBloquear');
    if (btnBloquear) {
        btnBloquear.addEventListener('click', async () => {
            const fecha = document.getElementById('fechaBloqueo').value;
            const hInicio = horaInicio.value;
            const hFin = horaFin.value;
            const barbero = document.getElementById('barberoBloqueo').value;

            if (!fecha || !hInicio || !hFin) { alert("Completá todos los campos"); return; }
            
            const [hI, mI] = hInicio.split(':').map(Number);
            const [hF, mF] = hFin.split(':').map(Number);
            let inicioMin = hI * 60 + mI;
            let finMin = hF * 60 + mF;

            if (inicioMin > finMin) { alert("La hora de inicio no puede ser mayor a la de fin"); return; }

            try {
                const promesas = [];
                // >>> AJUSTE 2: Grabado de bloqueos ahora salta cada 60 minutos (t += 60) <<<
                for (let t = inicioMin; t <= finMin; t += 60) {
                    let h = Math.floor(t / 60).toString().padStart(2, '0');
                    let m = (t % 60).toString().padStart(2, '0');
                    
                    promesas.push(addDoc(collection(db, "turnos"), {
                        fecha,
                        hora: `${h}:${m}`,
                        barbero,
                        nombre: "BLOQUEADO",
                        whatsapp: "0000000000",
                        servicio: "SIN SERVICIO",
                        precio: "$0",
                        estado: 'bloqueado',
                        creadoEn: new Date()
                    }));
                }
                await Promise.all(promesas);
                document.getElementById('modal-bloqueo').style.display = 'flex';
                document.getElementById('fechaBloqueo').value = '';
            } catch (e) { alert("Error: " + e.message); }
        });
    }

    // CONSULTA REALTIME
    const q = query(collection(db, "turnos"), orderBy("fecha", "asc"), orderBy("hora", "asc"));

    onSnapshot(q, (snapshot) => {
        if (!primeraCarga && snapshot.docChanges().some(change => change.type === "added")) {
            sonidoTurno.play().catch(e => console.log("Error de audio"));
        }
        primeraCarga = false; 

        tablaBody.innerHTML = '';
        let turnosHoy = 0; 
        let cuentaSeba = 0; 
        let recaudacionHoy = 0;
        
        let vistaActiva = 'turnos';
        if (document.getElementById('btn-ver-bloqueos')?.classList.contains('activo')) vistaActiva = 'bloqueos';
        if (document.getElementById('btn-ver-historial')?.classList.contains('activo')) vistaActiva = 'historial';

        // >>> NUEVO: ORDENAMIENTO FORZADO EN EL FRONT-END <<<
        const docsOrdenados = snapshot.docs.sort((a, b) => {
            const dataA = a.data();
            const dataB = b.data();
            // Creamos un string único como "2024-04-07 09:00" para comparar
            const fullA = `${dataA.fecha} ${dataA.hora}`;
            const fullB = `${dataB.fecha} ${dataB.hora}`;
            return fullA.localeCompare(fullB);
        });

        // Iteramos sobre el array ya ordenado en lugar de snapshot directo
        docsOrdenados.forEach((turnoDoc) => {
            const turno = turnoDoc.data();
            const id = turnoDoc.id;

            if (turno.barbero.toLowerCase().includes('seba')) {
                if (turno.estado === 'completado') {
                    cuentaSeba++;
                }
                if (turno.fecha === fechaHoy && turno.estado !== 'bloqueado') {
                    turnosHoy++;
                    const valor = parseInt(turno.precio?.replace(/[^0-9]/g, '')) || 0;
                    recaudacionHoy += valor;
                }
            }

            const numLimpio = turno.whatsapp.replace(/\D/g, '');
            const msjConfirmar = `¡Hola ${turno.nombre}! Tu turno en *AMB VIP* para el ${turno.fecha} a las ${turno.hora} hs ha sido *CONFIRMADO*. ¡Te esperamos! ✂️`;
            const msjRecordar = `¡Buen día ${turno.nombre}! Te recordamos tu turno de *HOY* en *AMB VIP* a las ${turno.hora} hs. ¡Nos vemos! 💈`;

            const fila = document.createElement('tr');
            const esPasado = turno.fecha < fechaHoy;
            const esCompletado = turno.estado === 'completado';
            const esBloqueado = turno.estado === 'bloqueado';

            fila.setAttribute('data-estado', turno.estado || 'pendiente');
            fila.setAttribute('data-fecha', turno.fecha);
            
            if (esCompletado) fila.classList.add('fila-completada');
            
            fila.style.display = 'none';
            if (vistaActiva === 'turnos' && !esBloqueado && !esCompletado && !esPasado) fila.style.display = '';
            else if (vistaActiva === 'bloqueos' && esBloqueado && !esPasado) fila.style.display = '';
            else if (vistaActiva === 'historial' && (esPasado || esCompletado) && !esBloqueado) fila.style.display = '';
            
            fila.innerHTML = `
                <td data-label="Fecha">${turno.fecha}</td>
                <td data-label="Hora">${turno.hora} hs</td>
                <td data-label="Cliente">${turno.nombre}</td>
                <td data-label="WhatsApp">${turno.whatsapp}</td>
                <td data-label="Servicio">${turno.servicio}</td>
                <td data-label="Precio" style="color: #aeff00; font-weight: bold;">${turno.precio || '-'}</td>
                <td class="acciones-celda">
                    <div class="botones-gestion-mobile">
                        ${turno.estado !== 'bloqueado' ? `
                            <a href="https://wa.me/${numLimpio}?text=${encodeURIComponent(msjConfirmar)}" target="_blank" title="Confirmar" class="btn-accion-mobile btn-confirmar-mobile">
                                <i class="fas fa-check-circle"></i> <span>Confirmar</span>
                            </a>
                            <a href="https://wa.me/${numLimpio}?text=${encodeURIComponent(msjRecordar)}" target="_blank" title="Recordar" class="btn-accion-mobile btn-recordar-mobile">
                                <i class="fas fa-bell"></i> <span>Avisar</span>
                            </a>
                        ` : ''}
                        
                        ${turno.estado !== 'completado' && turno.estado !== 'bloqueado' ? 
                            `<button class="btn-accion-mobile btn-check-mobile btn-check" data-id="${id}"><i class="fas fa-cash-register"></i> <span>Cobrar</span></button>` : 
                            (turno.estado === 'completado' ? '<span class="estado-completado">✔️ Cobrado</span>' : '')}
                        
                        <button class="btn-accion-mobile btn-delete-mobile btn-delete" data-id="${id}"><i class="fas fa-trash"></i> <span>Borrar</span></button>
                    </div>
                </td>
            `;
            tablaBody.appendChild(fila);
        });
        
        const domCuentaHoy = document.getElementById('cantHoy');
        const domCuentaSeba = document.getElementById('cantTotal');
        const domCajaHoy = document.getElementById('cajaHoy');

        if (domCuentaHoy) domCuentaHoy.innerText = turnosHoy;
        if (domCuentaSeba) domCuentaSeba.innerText = cuentaSeba;
        if (domCajaHoy) domCajaHoy.innerText = `$${recaudacionHoy.toLocaleString('es-AR')}`;
    });

    // EVENTOS DE CLICK (Mantenidos intactos)
    tablaBody.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        const id = target.getAttribute('data-id');

        if (target.classList.contains('btn-check')) {
            if (confirm("¿Marcar como completado/cobrado?")) {
                await updateDoc(doc(db, "turnos", id), { estado: 'completado' });
            }
        }
        if (target.classList.contains('btn-delete')) {
            if (confirm("¿Eliminar este registro?")) {
                await deleteDoc(doc(db, "turnos", id));
            }
        }
    });
});