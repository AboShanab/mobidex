import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { SafeAreaView } from 'react-native';
import { styles } from '../../../../styles';
import Tabs from '../../../components/Tabs';
import FillOrders from './FillOrders';
import LimitOrder from './LimitOrder';

const BUTTONS = ['Fill Orders', 'Limit Order'];

export default class BaseCreateOrderScreen extends Component {
  constructor(props) {
    super(props);

    this.state = {
      type: 0
    };
  }

  render() {
    const { side, base, quote } = this.props;
    const { type } = this.state;

    let subview = null;

    switch (this.state.type) {
      case 0:
        subview = <FillOrders side={side} base={base} quote={quote} />;
        break;

      case 1:
        subview = <LimitOrder side={side} base={base} quote={quote} />;
        break;
    }

    return (
      <SafeAreaView style={[styles.flex1]}>
        <Tabs onPress={this.changeTab} selectedIndex={type} buttons={BUTTONS} />
        {subview}
      </SafeAreaView>
    );
  }

  changeTab = type => this.setState({ type });
}

BaseCreateOrderScreen.propTypes = {
  type: PropTypes.string.isRequired,
  side: PropTypes.string.isRequired,
  base: PropTypes.object.isRequired,
  quote: PropTypes.object.isRequired
};
