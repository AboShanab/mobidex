import * as _ from "lodash";
import React, { Component } from "react";
import { View, TouchableOpacity } from "react-native";
import { List, ListItem } from "react-native-elements";
import { connect } from "react-redux";
import { loadOrders } from "../../thunks";
import OrderList from "../components/OrderList";
import TradingInfo from "../components/TradingInfo";
import TokenFilterBar from "../components/TokenFilterBar";

class TradingScreen extends Component {
  constructor(props) {
    super(props);

    this.state = {
      quoteToken: _.find(props.tokens, { address: props.products[0].tokenB.address })
    };
  }

  componentDidMount() {
    this.props.dispatch(loadOrders());
  }

  filteredOrders() {
    return this.props.orders.filter(order => order.makerTokenAddress === this.state.quoteToken.address || order.takerTokenAddress === this.state.quoteToken.address)
  }

  quoteTokens() {
    return _.uniqBy(this.props.products.map(p => p.tokenB).map(t => _.find(this.props.tokens, { address: t.address })), "address");
  }

  baseTokens() {
    return _.uniqBy(this.props.products.map(p => p.tokenA).map(t => _.find(this.props.tokens, { address: t.address })), "address");
  }

  render() {
    let quoteTokens = this.quoteTokens();
    let orders = this.filteredOrders();

    return (
      <View>
        <TokenFilterBar tokens={quoteTokens} selected={this.state.quoteToken} onPress={quoteToken => this.setState({ quoteToken })} />
        <TradingInfo quoteToken={this.state.quoteToken} orders={orders} />
        <OrderList quoteToken={this.state.quoteToken} orders={orders} onPress={({ orderHash }) => (this.props.navigation.navigate("OrderDetails", { orderHash }))} />
      </View>
    );
  }
}

export default connect((state) => ({ ...state.device, ...state.relayer }), (dispatch) => ({ dispatch }))(TradingScreen);
