// Variable para almacenar los datos cargados
let servicesData = [];

// Cargar datos del archivo JSON desde GitHub (enlace RAW)
fetch('https://raw.githubusercontent.com/marceoviedo1980/cartera-servicios/main/cartera_servicios.json?v=' + Date.now())
  .then(response => response.json())
  .then(data => {
    servicesData = data;
    console.log('Datos cargados:', servicesData);
  })
  .catch(error => console.error('Error al cargar los datos:', error));

// Función para realizar la búsqueda
function performSearch() {
  // Verificar que el elemento existe antes de acceder a su valor
  const searchInput = document.getElementById('searchInput');
  const resultsContainer = document.getElementById('results');

  if (!searchInput || !resultsContainer) {
    console.error('No se encontraron los elementos necesarios');
    return;
  }

  const input = searchInput.value.toLowerCase();
  resultsContainer.innerHTML = '';

  if (!input) {
    resultsContainer.innerHTML = '<p>Por favor, ingrese un término para buscar.</p>';
    return;
  }

  // Normalización de búsqueda
  const normalize = (str) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const normalizedInput = normalize(input);
  
  // Dividir el término de búsqueda en palabras individuales
  const searchTerms = normalizedInput.split(' ').filter(term => term.length > 0);

  // Filtrar los datos - buscar coincidencias para cada término
  const results = servicesData.filter(item => {
    const normalizedService = normalize(item.SERVICIO);
    // Verificar que todos los términos de búsqueda estén presentes en el servicio
    return searchTerms.every(term => normalizedService.includes(term));
  });

  // Mostrar resultados
  if (results.length > 0) {
    results.forEach(result => {
      let tipoPacienteClass = '';
      if (result["TIPO DE PACIENTE"].toLowerCase() === 'ambulatorio') {
        tipoPacienteClass = 'ambulatorio';
      } else if (result["TIPO DE PACIENTE"].toLowerCase() === 'internado') {
        tipoPacienteClass = 'internado';
      }

      const resultItem = `
        <div class="result-item">
          <strong>- <span class="codigo">CODIGO:</span> ${result.CODIGO}, <span class="servicio">SERVICIO:</span> ${result.SERVICIO}</strong>, TIPO DE PACIENTE: 
          <span class="${tipoPacienteClass}">${result["TIPO DE PACIENTE"]}</span>
        </div>
      `;
      resultsContainer.innerHTML += resultItem;
    });
  } else {
    resultsContainer.innerHTML = '<p>No se encontraron servicios relacionados. Intente con otros términos.</p>';
  }
}

// Asegurarse de que el DOM está cargado antes de añadir event listeners
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    // Añadir evento de tecla "Enter" para realizar la búsqueda
    searchInput.addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
        performSearch();
      }
    });
  }
});
