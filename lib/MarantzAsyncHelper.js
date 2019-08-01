"use strict";
var MarantzAsyncHelper = {};

MarantzAsyncHelper.debug                  = require('debug')('MarantzAsyncHelper:debug');
MarantzAsyncHelper.info                   = require('debug')('MarantzAsyncHelper:info');
MarantzAsyncHelper.warn                   = require('debug')('MarantzAsyncHelper:warn');
MarantzAsyncHelper.DenonMarantzTelnet     = require('marantz-denon-telnet')


MarantzAsyncHelper.debug.color = 2;   // hack. On windows debug doesn't seem to work real well, and even tho supports-colors
                                    // detects 16m colours, debug insists on only using 6.
MarantzAsyncHelper.info.color  = 2;
MarantzAsyncHelper.warn.color  = 2;


// This isn't async... but it keeps the encapsulation fairly well
MarantzAsyncHelper.GetClient = function(host)
{
    return new MarantzAsyncHelper.DenonMarantzTelnet(host);
}
MarantzAsyncHelper.GetPowerState = (client) => ({
        then(done) {
            client.getPowerState(function(error, data) {
                if(!error)
                {
                    MarantzAsyncHelper.debug('Power state of AVR is: ' + (data ? 'ON' : 'STANDBY') + ' - ' + data);
                    done(data ? 'ON' : 'STANDBY');
                }
                else
                {
                    MarantzAsyncHelper.debug('GetPowerState:Error when connecting to AVR: ' + error);
                    done(null);
                }
            });
        }
    });
MarantzAsyncHelper.SetPowerState = (client, power_state) => ({
        then(done)
        {
            MarantzAsyncHelper.debug('SetPowerState(%o)', power_state);

            client.setPowerState(power_state, function(error, data) {
                MarantzAsyncHelper.debug('SetPowerState returned %o and %o', error, data);
                if(!error)
                {
                    MarantzAsyncHelper.debug('AVR changed power state: ' + data);
                    MarantzAsyncHelper.debug('PW: %o', data);
                    done(data);
                }
                else
                {
                    MarantzAsyncHelper.debug('SetPowerState:Error when connecting to AVR: ' + error);
                    done(null);
                }
            });
        }
    });

MarantzAsyncHelper.GetVolume = (client) => ({
        then(done) {
            client.getVolume(function(error, data) {
                if(!error)
                {
                    var val = data;
                    MarantzAsyncHelper.debug('Volume of AVR is: %o',val);
                    done(val);
                }
                else
                {
                    MarantzAsyncHelper.debug('GetVolume:Error when connecting to AVR: %o',error);
                    done(null);
                }
            });
        }
    });
MarantzAsyncHelper.SetVolume = (client, volume) => ({
        then(done)
        {
            var val = volume;
            client.setVolume(val, function(error, data) {
                if(!error)
                {
                    MarantzAsyncHelper.debug('AVR changed volume: %o', data);
                    done(data);
                }
                else
                {
                    MarantzAsyncHelper.debug('SetVolume:Error when connecting to AVR: ' + error);
                    done(null);
                }
            });
        }
    });
MarantzAsyncHelper.GetMuteState = (client) => ({
        then(done) {
            client.getMuteState(function(error, data) {
                if(!error)
                {
                    MarantzAsyncHelper.debug('AVR has mute state: ' + data);
                    done(data);
                }
                else
                {
                    MarantzAsyncHelper.debug('GetMuteState:Error when connecting to AVR: ' + error);
                    done(null);
                }
            });
        }
    });
MarantzAsyncHelper.SetMuteState = (client, mute_state) => ({
        then(done)
        {
            client.setMuteState(mute_state, function(error, data) {
                if(!error)
                {
                    MarantzAsyncHelper.debug('AVR set mute state: %o', data);
                    done(data);
                }
                else
                {
                    MarantzAsyncHelper.debug('SetMuteState:Error when connecting to AVR: ' + error);
                    done(null);
                }
            });
        }
    });
MarantzAsyncHelper.GetInput = (client) => ({
        then(done) {
            client.getInput(function(error, data) {
                if(!error)
                {
                    MarantzAsyncHelper.debug('AVR has input: %o', data['SI']);
                    done(data['SI']);
                }
                else
                {
                    MarantzAsyncHelper.debug('GetInput:Error when connecting to AVR: ' + error);
                    done(null);
                }
            });
        }
    });
MarantzAsyncHelper.SetInput = (client, input) => ( {
    then(done) {
        MarantzAsyncHelper.debug("SetInput(%o)", input);
        client.setInput(input, function(error, data) {
            if(!error)
            {
                MarantzAsyncHelper.debug('AVR changed input: %o', data);
                done(data);
            }
            else
            {
                MarantzAsyncHelper.debug('SetInput:Error when connecting to AVR: ' + error);
                done(null);
            }
        });
    }});

// Having all the individual helpers is all well and good, but we want to collect
// all the state in one shot, in as short a time period as possible, and by breaking it up
// we force a tear down and reconnect each time.
// The underlying denon telnet library has a queue, so we can just fire all at once.
MarantzAsyncHelper.UpdateState = async function(client)
{
    MarantzAsyncHelper.info("UpdateState");
    let state = null;
    if(!client)
    {
        MarantzAsyncHelper.warn("No connection to AVR");
        return null;
    }

    const getPowerStateTask     = MarantzAsyncHelper.GetPowerState(client);
    const getVolumeTask         = MarantzAsyncHelper.GetVolume(client);
    const getMuteStateTask      = MarantzAsyncHelper.GetMuteState(client);
    const getInputTask          = MarantzAsyncHelper.GetInput(client);

    let power   = await getPowerStateTask;
    if (power === null)
    {
        // First check failed, possibly a connection error. Bailing out.
        MarantzAsyncHelper.warn("failed to get power");
        return false;
    }
    let volume  = await getVolumeTask;
    if (volume === null)
    {
        // First check failed, possibly a connection error. Bailing out.
        MarantzAsyncHelper.warn("failed to get power");
        return false;
    }
    let mute    = await getMuteStateTask;
    if (mute === null)
    {
        // First check failed, possibly a connection error. Bailing out.
        MarantzAsyncHelper.warn("failed to get mute");
        return false;
    }
    let input   = await getInputTask;
    if (input === null)
    {
        // First check failed, possibly a connection error. Bailing out.
        MarantzAsyncHelper.warn("failed to get input");
        return false;
    }

    state                            = {};
    state.volume_state               = {};
    state.volume_state.volume_value  = volume;
    state.volume_state.is_muted      = mute;
    state.source_state               = {};
    state.source_state.power         = power;
    state.source_state.input         = input;

    MarantzAsyncHelper.info("Got state: %o", state);
    return state;
}

MarantzAsyncHelper.UpdateStateOld = async function(client)
{
    MarantzAsyncHelper.info("UpdateState");
    let state = null;
    if(!client)
    {
        MarantzAsyncHelper.warn("No connection to AVR");
        return null;
    }


    let power   = await MarantzAsyncHelper.GetPowerState(client);
    if (power === null)
    {
        // First check failed, possibly a connection error. Bailing out.
        MarantzAsyncHelper.warn("failed to get power");
        return false;
    }
    let volume  = await MarantzAsyncHelper.GetVolume(client);
    if (volume === null)
    {
        // First check failed, possibly a connection error. Bailing out.
        MarantzAsyncHelper.warn("failed to get power");
        return false;
    }
    let mute    = await MarantzAsyncHelper.GetMuteState(client);
    let input   = await MarantzAsyncHelper.GetInput(client);

    state                            = {};
    state.volume_state               = {};
    state.volume_state.volume_value  = volume;
    state.volume_state.is_muted      = mute;
    state.source_state               = {};
    state.source_state.power         = power;
    state.source_state.input         = input;

    MarantzAsyncHelper.info("Got state: %o", state);
    return state;
}

Object.freeze(MarantzAsyncHelper);

module.exports = MarantzAsyncHelper;
