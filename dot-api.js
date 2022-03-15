const express = require("express");
const bodyParser = require("body-parser");
const app = express();

//Polkadot wallet libraries
const convert_ss58  = require('@polkadot/util-crypto');
const { hexToU8a, isHex } = require('@polkadot/util');
const {mnemonicGenerate,mnemonicValidate} =require('@polkadot/util-crypto');
const {ApiPromise, WsProvider} = require('@polkadot/api');
const {Keyring} = require('@polkadot/keyring');

//we are using keyring sr25519 to ecrypt and decrypt the address and public key
const keyring = new Keyring({type: 'sr25519'});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var server = app.listen(process.env.PORT || 10094, function () {
    var port = server.address().port;
    console.log("Polkadot App now running on port", port);
});

//Test network  wss://westend-rpc.polkadot.io
//Main Network  wss://rpc.polkadot.io
const wsProvider = new WsProvider('wss://westend-rpc.polkadot.io');
const api = new ApiPromise({ provider: wsProvider });

//Create account using mnemonic , address type: Polka addresses
app.get("/api/dot/addressGeneration",function(req,res){

    const createAccount = (mnemonic) => {
        mnemonic = mnemonic && mnemonicValidate(mnemonic) ? mnemonic : mnemonicGenerate();
        const account = keyring.addFromMnemonic(mnemonic);
        return { account, mnemonic };
    }

    (async () => {
        return api.isReady;
    })().then(async(api) => {
        const mnemonic = mnemonicGenerate();
        const account = keyring.addFromMnemonic(mnemonic);
        let default_address=account.address;   
        let public_key=convert_ss58.encodeAddress(default_address,42);

        let pool_address_activation_seed=""; //pool account for account activation
        
        const { account: sender } = createAccount(pool_address_activation_seed);
        const address2 =public_key; //It is the user new publickey
        const sendingAmount = 0.2; //Minimum balance to activate the account
        const decimal = 10 ** api.registry.chainDecimals
        const account1balance = await api.derive.balances.all(sender.address);
        //converting binary balance to decimal
        const availableBalance = account1balance.availableBalance / decimal
        //converting decimal amount to binary
        const amount = sendingAmount * decimal;
        //transfering coin (WND) 
        const transfer = api.tx.balances.transfer(address2, amount);
        const { partialFee } = await transfer.paymentInfo(sender.address);
        const fees = partialFee.muln(110).divn(100);

        const tx = await transfer.signAndSend(sender);
        if(tx !=null) {
            res.send({"StatusCode":"1","Message":"DOT address generation is successful.","pubkey":public_key,"privkey":mnemonic});
        }
        else {
            res.send({"StatusCode":"0","Message":"Error"});
        }

    }).catch((err) => {
        res.send({"StatusCode":"0","Message":"Error"});
    });
})

//Create account using mnemonic , address type: Generic Substrate addresses
app.get('/api/dot/generatePolkaAddress', async (req, res) => {
    console.log('generatePolkaAddress')
    let mnemonic = mnemonicGenerate();
    const account = keyring.addFromMnemonic(mnemonic);

    res.send({ account, mnemonic });
})

//Import seed to get account details
app.post('/api/dot/importPrivateKey', async (req, res) => {
    var {mnemonic} = req.body

    if (mnemonic && mnemonicValidate(mnemonic)) {
        const account = keyring.addFromMnemonic(mnemonic);;
        var info = {
            address : account.address,
            isLocked : account.isLocked
        }
        res.send(info);
        // res.send({account});
    }
    else {
        res.send({ error: "Invalid Mnemonic" });
    }
})

// TO TRANSFER THE DOT BALANCE (FUND)
app.post("/api/dot/fundTransfer",function(req,res){
    var {senderprivkey, receiverpubkey, amount} = req.body
    const createAccount = (mnemonic) => {
        mnemonic = mnemonic && mnemonicValidate(mnemonic) ? mnemonic : mnemonicGenerate();
        const account = keyring.addFromMnemonic(mnemonic);
        return { account, mnemonic };
    }

    (async () => {
        return api.isReady;
    })().then(async(api) => {
        const sender_seed = senderprivkey;
        console.log(`Our client is connected: ${api.isConnected}`);
        const { account: sender } = createAccount(sender_seed);
        //receivers address
        const address2 = receiverpubkey;
        // amount to be transfer
        const sendingAmount =parseFloat(amount);
        const decimal = 10 ** api.registry.chainDecimals
        const account1balance = await api.derive.balances.all(sender.address);
        //converting binary balance to decimal
        const availableBalance = account1balance.availableBalance / decimal
        const totamount = sendingAmount * decimal;
        const transfer = api.tx.balances.transfer(address2, totamount);
        //Transaction fee calculation
        const { partialFee } = await transfer.paymentInfo(sender.address);
        const fees = partialFee.muln(110).divn(100);
        const totalAmount = (totamount + parseFloat(fees) + parseFloat(api.consts.balances.existentialDeposit)) / decimal

        if (totalAmount > availableBalance) {
            //res.send({ error: `Cannot transfer ${totalAmount} with ${availableBalance} left` });
            console.log(`Cannot transfer ${totalAmount} with ${availableBalance} left`);
            return res.send({"StatusCode":"0","Message":"Insufficient balance"});
        }
        else {
            const tx = await transfer.signAndSend(sender);
            console.log("Txn hash.."+ tx);
            return res.send({"txnhash":tx,"StatusCode":"1","Message":"DOT has been sent successfully"});
        }
    }).catch((err) => {
        console.log('err in fund transfer', err);
        res.json({StatusCode:"0",Message:"Error"});
    });
})

app.get("/api/dot/getBalance/:pubkey",function(req,res){
    var pubkey = req.params.pubkey
    (async () => {
        return api.isReady;
    })().then(async(api) => {
        const balance = await api.derive.balances.all(pubkey);
        const available = balance.availableBalance.toNumber();
        const dots = available / (10 ** api.registry.chainDecimals);
        const print = dots.toFixed(12);
        res.send({balance:print, StatusCode:"1", Message:"Balance is found."});

    }).catch((err) => {
        console.log("error in getBalance", err);
        res.json({"StatusCode":"0","Message":"API Error"});
    });
})
