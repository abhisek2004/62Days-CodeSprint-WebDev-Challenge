document.addEventListener('DOMContentLoaded', () => {
  const barContainer = document.getElementById('barContainer');
  const generateArrBtn = document.getElementById('generateArrBtn');
  const startSortBtn = document.getElementById('startSortBtn');

  let array = [];

  function generateArray() {
    array = [];
    barContainer.innerHTML = '';
    for (let i = 0; i < 25; i++) {
      const val = Math.floor(20 + Math.random() * 380);
      array.push(val);
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = `${val}px`;
      barContainer.appendChild(bar);
    }
  }

  async function bubbleSort() {
    const bars = barContainer.children;
    startSortBtn.disabled = true;

    for (let i = 0; i < array.length; i++) {
      for (let j = 0; j < array.length - i - 1; j++) {
        bars[j].classList.add('comparing');
        bars[j + 1].classList.add('comparing');

        await new Promise(r => setTimeout(r, 60));

        if (array[j] > array[j + 1]) {
          let temp = array[j];
          array[j] = array[j + 1];
          array[j + 1] = temp;

          bars[j].style.height = `${array[j]}px`;
          bars[j + 1].style.height = `${array[j + 1]}px`;
        }

        bars[j].classList.remove('comparing');
        bars[j + 1].classList.remove('comparing');
      }
      bars[array.length - i - 1].classList.add('sorted');
    }

    startSortBtn.disabled = false;
  }

  generateArrBtn.addEventListener('click', generateArray);
  startSortBtn.addEventListener('click', bubbleSort);

  generateArray();
});
