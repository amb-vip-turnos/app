import { db } from './firebase-config.js';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    
    const tablaBody = document.getElementById('tabla-turnos');
    if (!tablaBody) return;

    const hoy = new Date();
    const fechaHoy = hoy.toISOString().split('T')[0]; 

    const horaInicio = document.getElementById('horaInicio');
    const horaFin = document.getElementById('horaFin');
    
    if (horaInicio && horaFin) {
        for (let h = 9; h <= 20; h++) {
            for (let m = 0; m < 60; m += 30) {
                if (h === 20 && m > 30) break;
                let hora = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                horaInicio.innerHTML += `<option value="${hora}">${hora}</option>`;
                horaFin.innerHTML += `<option value="${hora}">${hora}</option>`;
            }
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
                for (let t = inicioMin; t <= finMin; t += 30) {
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

    onSnapshot(collection(db, "turnos"), (snapshot) => {
        tablaBody.innerHTML = '';
        let turnosHoy = 0; 
        let cuentaSeba = 0; 
        let recaudacionHoy = 0;
        
        snapshot.forEach((turnoDoc) => {
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
            if (turno.estado === 'completado') fila.classList.add('fila-completada');
            
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
        
        // RED DE SEGURIDAD PARA LOS IDs DEL DOM: Busca el ID nuevo o el viejo, así no falla nunca.
        const domCuentaHoy = document.getElementById('cantHoy') || document.getElementById('cuenta-hoy');
        const domCuentaSeba = document.getElementById('cantTotal') || document.getElementById('contador-seba');
        const domCajaHoy = document.getElementById('cajaHoy');

        if (domCuentaHoy) domCuentaHoy.innerText = turnosHoy;
        if (domCuentaSeba) domCuentaSeba.innerText = cuentaSeba;
        if (domCajaHoy) domCajaHoy.innerText = `$${recaudacionHoy.toLocaleString('es-AR')}`;
    });

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