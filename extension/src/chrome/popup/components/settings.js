import React from 'react';
import _ from 'lodash';

import Switch from '@material-ui/core/Switch';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import PowerSettingsNewIcon from '@material-ui/icons/PowerSettingsNew'
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListItemText from '@material-ui/core/ListItemText';
import ListItem from '@material-ui/core/ListItem';
import InputLabel from '@material-ui/core/InputLabel';
import Input from '@material-ui/core/Input';
import StepIcon from '@material-ui/core/StepIcon';
import FormHelperText from '@material-ui/core/FormHelperText';
import List from '@material-ui/core/List';

// bo is the browser object, in chrome is named 'chrome', in firefox is 'browser'
const bo = chrome || browser;


class Settings extends React.Component {
  constructor(props) {
    console.log('Props in Settings constructor', props);
    super(props);
    this.state = {
      active: props.active,
      ux: props.ux,
      backend: props.backend,
      mobilizon: props.mobilizon,
      login: props.login,
      password: props.password,
    };
  }

  render() {
    function toggleActivation(_t, event) {
      console.log('Active (value)', event.target.checked);
      _t.setState({ active: event.target.checked });
      saveUpdate({ active: event.target.checked });
    }

    function toggleUX(_t, event) {
      console.log('UX (value)', event.target.checked);
      _t.setState({ ux: event.target.checked });
      saveUpdate({ ux: event.target.checked });
    }

    function saveUpdate(payload) {
      console.log(`saveUpdate of ${payload}`);
      bo.runtime.sendMessage(
        {
          type: 'ConfigUpdate',
          payload,
        },
        (status) => {
          console.log('status confirmed', status);
        }
      );
    }

    const doSetOption = (event) => {
      const targetData = event.target.id;
      const update = {};
      update[targetData] = event.target.value;
      this.setState(update);
      console.log("Read option", targetData, "updating with value:", event.target.value)
      saveUpdate(update);
    };

    if (!this.state) return <p>Loading...</p>;

    console.log('settings props state', this.props, this.state);

    const entryStyle = { display: 'flex', flexDirection: 'row', alignItems: 'center' };
    return (
    <List component="nav" aria-label="main settings">

      <ListItem style={{entryStyle}}>
        <FormHelperText>Mobilizone</FormHelperText>
        <Input id="mobilizon" value={this.state.mobilizon} style={{ marginLeft: 8, width: 380 }} onChange={doSetOption} />
      </ListItem>

      <ListItem style={{entryStyle}}>
        <FormHelperText>Login</FormHelperText>
        <Input id="login" value={this.state.login} style={{ marginLeft: 8, width: 380 }} onChange={doSetOption} />
      </ListItem>

      <ListItem style={{entryStyle}}>
        <FormHelperText>Password</FormHelperText>
        <Input id="password" type="password" value={this.state.password} style={{ marginLeft: 8, width: 340 }} onChange={doSetOption} />
      </ListItem>

      <hr />
      <hr />

      <ListItem>

        <ListItemIcon>
          <PowerSettingsNewIcon fontSize="large" color={ (!!this.state && !!this.state.active) ? 'primary' : 'disabled' } />
        </ListItemIcon>

        <ListItemText primary={ (!!this.state && !!this.state.active) ? "Enabled" : "Disabled"} />
        <ListItemSecondaryAction>
          <Switch
            edge="end"
            onChange={_.partial(toggleActivation, this)}
            checked={this.state ? !!this.state.active : false }
            inputProps={{ 'aria-labelledby': 'main-switch' }}
          />
        </ListItemSecondaryAction>
      </ListItem>

      <ListItem style={{entryStyle}}>
        <FormHelperText>Backend server</FormHelperText>
        <Input id="backend" value={this.state.backend} style={{ marginLeft: 8, width: 280 }} onChange={doSetOption} />
      </ListItem>

    </List>);
  }
};

export default Settings;
