document.addEventListener('DOMContentLoaded', () => {
  const products = [
    { id: 1, name: 'Wireless Headphones', price: 99.99, category: 'Electronics' },
    { id: 2, name: 'Running Shoes', price: 79.50, category: 'Footwear' },
    { id: 3, name: 'Smart Watch', price: 149.00, category: 'Electronics' },
    { id: 4, name: 'Backpack', price: 45.00, category: 'Accessories' }
  ];

  let cart = [];
  const micBtn = document.getElementById('micBtn');
  const voiceWave = document.getElementById('voiceWave');
  const speechStatus = document.getElementById('speechStatus');
  const productGrid = document.getElementById('productGrid');
  const cartItems = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');

  // Text to Speech Synth
  function speak(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }

  // Render Products
  function renderProducts(list = products) {
    productGrid.innerHTML = '';
    list.forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <div>
          <h3>${p.name}</h3>
          <p style="color:#94a3b8;font-size:0.85rem">${p.category}</p>
        </div>
        <div class="price">$${p.price.toFixed(2)}</div>
        <button class="btn-add" onclick="addToCart(${p.id})">Add to Cart</button>
      `;
      productGrid.appendChild(card);
    });
  }

  window.addToCart = function(productId) {
    const item = products.find(p => p.id === productId);
    if (item) {
      cart.push(item);
      renderCart();
      speak(`Added ${item.name} to your cart.`);
    }
  };

  function renderCart() {
    if (cart.length === 0) {
      cartItems.innerHTML = '<p class="empty-msg">Your cart is empty.</p>';
      cartTotal.textContent = '$0.00';
      return;
    }

    cartItems.innerHTML = '';
    let total = 0;
    cart.forEach((item, index) => {
      total += item.price;
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `
        <span>${item.name}</span>
        <strong>$${item.price.toFixed(2)}</strong>
      `;
      cartItems.appendChild(div);
    });
    cartTotal.textContent = `$${total.toFixed(2)}`;
  }

  // Web Speech API
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      micBtn.classList.add('listening');
      voiceWave.classList.add('active');
      speechStatus.textContent = "Listening to your voice command...";
    };

    recognition.onend = () => {
      micBtn.classList.remove('listening');
      voiceWave.classList.remove('active');
    };

    recognition.onresult = (event) => {
      const command = event.results[0][0].transcript.toLowerCase();
      speechStatus.textContent = `You said: "${command}"`;
      handleVoiceCommand(command);
    };
  } else {
    speechStatus.textContent = "Web Speech API not supported in this browser. Use manual buttons.";
  }

  function handleVoiceCommand(cmd) {
    if (cmd.includes('search') || cmd.includes('find')) {
      const term = cmd.replace('search', '').replace('find', '').trim();
      const filtered = products.filter(p => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term));
      renderProducts(filtered);
      speak(`Found ${filtered.length} products matching ${term}`);
    } else if (cmd.includes('add')) {
      const match = products.find(p => cmd.includes(p.name.toLowerCase()));
      if (match) {
        addToCart(match.id);
      } else {
        speak("Sorry, I could not find that item in the store.");
      }
    } else if (cmd.includes('read cart') || cmd.includes('what is in my cart')) {
      if (cart.length === 0) {
        speak("Your cart is empty.");
      } else {
        const names = cart.map(i => i.name).join(', ');
        const total = cart.reduce((acc, i) => acc + i.price, 0);
        speak(`You have ${cart.length} items: ${names}. Total is $${total.toFixed(2)}`);
      }
    } else if (cmd.includes('checkout')) {
      if (cart.length === 0) {
        speak("Your cart is empty. Please add items before checkout.");
      } else {
        speak(`Proceeding to checkout. Your total order amount is ${cartTotal.textContent}. Thank you for shopping with us!`);
        cart = [];
        renderCart();
      }
    } else {
      speak("Command not recognized. Try saying search shoes or add headphones.");
    }
  }

  micBtn.addEventListener('click', () => {
    if (recognition) {
      recognition.start();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault();
      if (recognition) recognition.start();
    }
  });

  document.getElementById('voiceCheckoutBtn').addEventListener('click', () => {
    handleVoiceCommand('checkout');
  });

  renderProducts();
});
