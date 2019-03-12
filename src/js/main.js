class PrezoController extends NGNX.VIEW.Registry {
  constructor (cfg) {
    super(Object.assign({}, {
      selector: '#prezo',
      namespace: 'prezo.',

      references: {
        cycle: '> author-cycle',
        slides: '> author-cycle > *'
      }
    }, cfg))

    this.keySource = 'key' in KeyboardEvent.prototype ? 'key' : ('keyIdentifier' in KeyboardEvent.prototype ? 'keyIdentifier' : 'keyCode')
  }

  next () {
    this.ref.cycle.element.next()
  }

  previous () {
    this.ref.cycle.element.previous()
  }

  goto (index) {
    this.ref.cycle.element.show(index)
  }
}

window.Prezo = new PrezoController()

window.Prezo.on({
  initialized: function () {
    let { cycle, slides } = this.ref

    slides.each((slide, index) => slide.dataset.index = index)

    cycle.on({
      beforechange: evt => {
        evt.preventDefault()
        let { currentSelection, nextSelection, next } = evt.detail

        this.emit('beforechange', {
          currentSlide: currentSelection,
          nextSlide: nextSelection
        })

        cycle.element.setAttribute('transition', '')
        currentSelection.element.setAttribute('fade-out', '')
        setTimeout(next, 500)
      },

      change: evt => {
        let { previousSelection, currentSelection } = evt.detail

        this.emit('change', {
          previousSlide: previousSelection,
          currentSlide: currentSelection
        })

        cycle.element.removeAttribute('transition')
        previousSelection.element.removeAttribute('fade-out')
        currentSelection.element.setAttribute('fade-in', '')
        setTimeout(() => currentSelection.element.removeAttribute('fade-in'), 1000)
      }
    })

    document.addEventListener('keyup', evt => {
      switch (evt.key) {
        case 'ArrowRight':
        case ' ':
          return this.next()

        case 'ArrowLeft':
        case 'Backspace':
          return this.previous()
      }
    })
  }.bind(window.Prezo)
})
