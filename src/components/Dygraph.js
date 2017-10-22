import React from 'react'
import PropTypes from 'prop-types'
import DygraphBase from 'dygraphs'
import { propTypes as dygraphPropTypes, spreadProps as spreadKnownProps } from './Dygraph/options'
import FixedYAxis from '../plugins/FixedYAxis'
import Normalize from '../plugins/Normalize'
import Downsample from '../plugins/Downsample'

class InteractionModelProxy {
  constructor () {
    for (const method of ['mousedown', 'touchstart', 'touchmove', 'touchend', 'dblclick']) {
      const thisProxy = this
      this[method] = function (...args) {
        const calledContext = this
        return thisProxy._target[method].call(calledContext, ...args)
      }
    }
    ['willDestroyContextMyself'].forEach(prop => {
      Object.defineProperty(this, prop, {
        configurable: false,
        enumerable: true,
        get: () => this._target[prop],
        set: value => (this._target[prop] = value),
      })
    })
  }

  _target = DygraphBase.defaultInteractionModel
}

export default class Dygraph extends React.Component {
  displayName = 'Dygraph'

  static propTypes = {
    fixedYAxis: PropTypes.bool,
    downsample: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.shape({
        visibleThreshold: PropTypes.number,
        invisibleThreshold: PropTypes.number,
      }),
    ]),
    normalize: PropTypes.shape({
      notches: PropTypes.number,
      ranges: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
    }),
    style: PropTypes.object,
    ...dygraphPropTypes,
  }

  componentDidMount () {
    const {known: {selection, ...initAttrs}} = spreadKnownProps(this.props, true)
    this._interactionProxy._target =
      initAttrs.interactionModel || DygraphBase.defaultInteractionModel
    initAttrs.interactionModel = this._interactionProxy

    if (!initAttrs.plugins) {
      initAttrs.plugins = []
    }

    if (this.props.normalize) {
      initAttrs.plugins.push(new Normalize(this.props.normalize))
    }

    if (this.props.downsample) {
      let options = this.props.downsample

      if (typeof this.props.downsample === 'boolean') {
        options = null
      }

      initAttrs.plugins.push(new Downsample(options))
    }

    if (this.props.fixedYAxis) {
      initAttrs.plugins.push(new FixedYAxis())
    }

    this._dygraph = new DygraphBase(this.root, this.props.data, initAttrs)

    if (typeof selection !== 'undefined') {
      this._dygraph.setSelection(...selection)
    }
  }

  componentWillUpdate (nextProps) {
    if (this._dygraph) {
      const {known: {selection, ...updateAttrs}} = spreadKnownProps(nextProps, false)
      this._interactionProxy._target =
        updateAttrs.interactionModel || DygraphBase.defaultInteractionModel
      updateAttrs.interactionModel = this._interactionProxy

      if (nextProps.normalize && nextProps.normalize !== this.props.normalize) {
        this._dygraph.plugins_.find(p => p.plugin instanceof Normalize).plugin.updateOptions(nextProps.normalize)
      }

      this._dygraph.updateOptions(updateAttrs)

      if (typeof selection !== 'undefined') {
        this._dygraph.setSelection(...selection)
      }
    }
  }

  componentWillUnmount () {
    if (this._dygraph) {
      this._dygraph.destroy()
      this._dygraph = null
    }
  }

  _interactionProxy = new InteractionModelProxy()

  render () {
    return (
      <div
        ref={(root) => (this.root = root)}
        style={this.props.style}
      />
    )
  }
}