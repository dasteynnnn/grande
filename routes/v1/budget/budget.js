// import express from 'express';
// import dotenv, { parse } from 'dotenv';

const express = require('express')

const service = require('./budgetService.js')

// import service from './budgetService'

// dotenv.config();

const router = express.Router();

// GET /api/v1/budget/
router.post('/', async (req, res) => {

    const body = req.body

    console.log(body)

    let result = []

    const response = {
      status : "Success"
    }

  res.send(result)

});

// POST /api/v1/budget/mad
router.post('/mad', async (req, res) => {

  const body = req.body;

  let result = [];
  
  let balance = body.balance;
  const mad = body.mad / 100;
  const interest = body.interest / 100;
  const payment = body.payment;
  const maxMonth = 60
  
  let pesofy = data => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(data)
  }
  
  for (let m = 1, b = balance; b > 0; m++) {

    if(m <= maxMonth) {
      let monthInterest = b * interest;
      let monthBalance = b + monthInterest;
      let monthMad = monthBalance * mad;

      if(monthMad <= 500) monthMad = 500
  
      if(b < payment) {
        result.push({
          month: m,
          balance: pesofy(monthBalance),
          interest: pesofy(monthInterest),
          mad: pesofy(monthMad),
          payment: pesofy(monthBalance),
          balanceAfterPayment: pesofy(0)
        })
        b = 0
      } else {
        result.push({
          month: m,
          balance: pesofy(monthBalance),
          interest: pesofy(monthInterest),
          mad: pesofy(monthMad),
          payment: pesofy(monthBalance),
          balanceAfterPayment: pesofy(monthBalance - payment)
        })
        b = monthBalance - payment;
      }
    } else {
      b = 0
    }
  }
  
  const response = {
    status: "Success",
    data: result,
  };

  res.send(response)

});

export default router;
