(() => {
  'use strict';

  const expressionEl = document.getElementById('expression');
  const resultEl = document.getElementById('result');
  const historyEl = document.getElementById('history');

  const OPERATORS = ['+', '-', '*', '/'];
  const MAX_LENGTH = 30;

  const formatter = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 12,
  });

  const state = {
    expression: '',
    history: '',
    preview: null,
    error: '',
    justEvaluated: false,
  };

  /* ------------------------------------------------------------------ */
  /*  Parser sederhana tanpa eval()                                      */
  /* ------------------------------------------------------------------ */

  function tokenize(input) {
    const tokens = [];
    let index = 0;

    while (index < input.length) {
      const char = input[index];

      if (char === ' ') {
        index += 1;
        continue;
      }

      if (/[0-9.]/.test(char)) {
        let number = '';

        while (index < input.length && /[0-9.]/.test(input[index])) {
          number += input[index];
          index += 1;
        }

        if (number === '.' || (number.match(/\./g) || []).length > 1) {
          throw new Error('invalid');
        }

        tokens.push({ type: 'number', value: Number(number) });
        continue;
      }

      if ('+-*/%'.includes(char)) {
        tokens.push({ type: char });
        index += 1;
        continue;
      }

      throw new Error('invalid');
    }

    return tokens;
  }

  function evaluate(expression) {
    const tokens = tokenize(expression);
    let position = 0;

    const peek = () => tokens[position];

    function parseFactor() {
      let sign = 1;

      while (peek() && (peek().type === '+' || peek().type === '-')) {
        if (peek().type === '-') sign *= -1;
        position += 1;
      }

      const token = peek();
      if (!token || token.type !== 'number') throw new Error('invalid');

      position += 1;
      let value = token.value;

      while (peek() && peek().type === '%') {
        value /= 100;
        position += 1;
      }

      return sign * value;
    }

    function parseTerm() {
      let value = parseFactor();

      while (peek() && (peek().type === '*' || peek().type === '/')) {
        const operator = tokens[position].type;
        position += 1;
        const right = parseFactor();

        if (operator === '*') {
          value *= right;
        } else {
          if (right === 0) throw new Error('div0');
          value /= right;
        }
      }

      return value;
    }

    function parseExpression() {
      let value = parseTerm();

      while (peek() && (peek().type === '+' || peek().type === '-')) {
        const operator = tokens[position].type;
        position += 1;
        const right = parseTerm();

        value = operator === '+' ? value + right : value - right;
      }

      return value;
    }

    const value = parseExpression();

    if (position !== tokens.length) throw new Error('invalid');
    if (!Number.isFinite(value)) throw new Error('div0');

    return value;
  }

  /* ------------------------------------------------------------------ */
  /*  Format tampilan                                                    */
  /* ------------------------------------------------------------------ */

  function roundValue(value) {
    return Number.parseFloat(value.toPrecision(12));
  }

  function formatValue(value) {
    return formatter.format(roundValue(value));
  }

  function displayExpression(expression) {
    return expression
      .replace(/\d+(?:\.\d*)?/g, (match) => {
        const [integer, decimal] = match.split('.');
        const grouped = formatter.format(Number(integer));
        return decimal === undefined ? grouped : `${grouped},${decimal}`;
      })
      .replace(/\*/g, '×')
      .replace(/\//g, '÷')
      .replace(/-/g, '−');
  }

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  function refreshPreview() {
    state.preview = null;
    state.error = '';

    const expression = state.expression;
    if (!expression) return;
    if (/^-?\d+(?:\.\d*)?$/.test(expression)) return;
    if (/[+\-*/]$/.test(expression)) return;

    try {
      state.preview = evaluate(expression);
    } catch (error) {
      if (error.message === 'div0') state.error = 'Tidak bisa dibagi nol';
    }
  }

  function render() {
    const shownExpression = displayExpression(state.expression) || '0';

    expressionEl.textContent = shownExpression;
    expressionEl.classList.toggle('is-small', shownExpression.length > 12);
    historyEl.textContent = state.history;

    if (state.error) {
      resultEl.textContent = state.error;
      resultEl.classList.add('error');
      return;
    }

    resultEl.classList.remove('error');
    resultEl.textContent = state.preview === null ? '' : `= ${formatValue(state.preview)}`;
  }

  function update() {
    refreshPreview();
    render();
  }

  /* ------------------------------------------------------------------ */
  /*  Aksi tombol                                                        */
  /* ------------------------------------------------------------------ */

  function currentNumberSegment() {
    const match = state.expression.match(/(\d*\.?\d*)$/);
    return match ? match[1] : '';
  }

  function inputDigit(digit) {
    if (state.justEvaluated) {
      state.expression = '';
      state.justEvaluated = false;
    }

    if (state.expression.length >= MAX_LENGTH) return;
    if (state.expression.endsWith('%')) return;

    const segment = currentNumberSegment();

    if (segment === '0') {
      state.expression = state.expression.slice(0, -1) + digit;
    } else {
      state.expression += digit;
    }

    update();
  }

  function inputOperator(operator) {
    state.justEvaluated = false;

    if (!state.expression) {
      if (operator === '-') {
        state.expression = '-';
        update();
      }
      return;
    }

    if (state.expression.length >= MAX_LENGTH) return;

    const last = state.expression[state.expression.length - 1];

    if (OPERATORS.includes(last)) {
      const stripped = state.expression.replace(/[+\-*/]+$/, '');

      if (!stripped) {
        state.expression = operator === '-' ? '-' : '';
      } else {
        state.expression = stripped + operator;
      }

      update();
      return;
    }

    if (last === '.') {
      state.expression = state.expression.slice(0, -1);
    }

    state.expression += operator;
    update();
  }

  function inputDecimal() {
    if (state.justEvaluated) {
      state.expression = '';
      state.justEvaluated = false;
    }

    if (state.expression.length >= MAX_LENGTH) return;
    if (state.expression.endsWith('%')) return;

    const segment = currentNumberSegment();
    if (segment.includes('.')) return;

    state.expression += segment === '' ? '0.' : '.';
    update();
  }

  function inputPercent() {
    state.justEvaluated = false;

    const expression = state.expression;
    if (!expression || state.expression.length >= MAX_LENGTH) return;

    const last = expression[expression.length - 1];
    if (last === '%' || last === '.' || OPERATORS.includes(last)) return;

    state.expression = expression + '%';
    update();
  }

  function toggleSign() {
    state.justEvaluated = false;

    if (!state.expression) {
      state.expression = '-';
      update();
      return;
    }

    const segment = currentNumberSegment();
    if (!segment) return;

    if (segment === '0' || segment === '0.') return;

    const start = state.expression.length - segment.length;
    const before = state.expression.slice(0, start);
    const isUnaryMinus =
      before.endsWith('-') && (start - 1 === 0 || OPERATORS.includes(before[before.length - 2]));

    state.expression = isUnaryMinus
      ? before.slice(0, -1) + segment
      : before + '-' + segment;

    update();
  }

  function deleteLast() {
    if (state.justEvaluated) {
      clearAll();
      return;
    }

    state.expression = state.expression.slice(0, -1);
    update();
  }

  function clearAll() {
    state.expression = '';
    state.history = '';
    state.preview = null;
    state.error = '';
    state.justEvaluated = false;
    render();
  }

  function calculate() {
    if (!state.expression) return;

    const trimmed = state.expression.replace(/[+\-*/]+$/, '');
    if (!trimmed || trimmed === '-') return;

    try {
      const value = evaluate(trimmed);
      state.history = `${displayExpression(trimmed)} =`;
      state.expression = String(roundValue(value));
      state.justEvaluated = true;
      state.preview = null;
      state.error = '';
    } catch (error) {
      state.error =
        error.message === 'div0' ? 'Tidak bisa dibagi nol' : 'Ekspresi tidak valid';
      state.justEvaluated = false;
    }

    render();
  }

  /* ------------------------------------------------------------------ */
  /*  Event                                                              */
  /* ------------------------------------------------------------------ */

  function handleButton(button) {
    const { digit, operator, action } = button.dataset;

    if (digit !== undefined) inputDigit(digit);
    else if (operator !== undefined) inputOperator(operator);
    else if (action === 'decimal') inputDecimal();
    else if (action === 'percent') inputPercent();
    else if (action === 'sign') toggleSign();
    else if (action === 'delete') deleteLast();
    else if (action === 'clear') clearAll();
    else if (action === 'equals') calculate();
  }

  function flash(selector) {
    const button = document.querySelector(selector);
    if (!button) return;

    button.classList.add('is-pressed');
    window.setTimeout(() => button.classList.remove('is-pressed'), 120);
  }

  function handleKeydown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLButtonElement && (event.key === 'Enter' || event.key === ' ')) {
      return;
    }

    const { key } = event;
    let handled = true;

    if (/^[0-9]$/.test(key)) {
      inputDigit(key);
      flash(`[data-digit="${key}"]`);
    } else {
      switch (key) {
        case '.':
        case ',':
          inputDecimal();
          flash('[data-action="decimal"]');
          break;
        case '+':
        case '-':
        case '*':
        case '/':
          inputOperator(key);
          flash(`[data-operator="${key}"]`);
          break;
        case 'x':
        case 'X':
          inputOperator('*');
          flash('[data-operator="*"]');
          break;
        case '%':
          inputPercent();
          flash('[data-action="percent"]');
          break;
        case 'Enter':
        case '=':
          calculate();
          flash('[data-action="equals"]');
          break;
        case 'Backspace':
          deleteLast();
          flash('[data-action="delete"]');
          break;
        case 'Escape':
        case 'Delete':
          clearAll();
          flash('[data-action="clear"]');
          break;
        default:
          handled = false;
      }
    }

    if (handled) event.preventDefault();
  }

  document.querySelectorAll('.key').forEach((button) => {
    button.addEventListener('click', () => handleButton(button));
  });

  document.addEventListener('keydown', handleKeydown);

  render();
})();
