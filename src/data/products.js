export const products = [
  {
    id: 1,
    name: "Hamburguesa Clásica",
    category: "hamburguesas",
    price: 12000,
    image: "/hamburguesas/hamburguesa-simple.jpg",
    description: "Hamburguesa con carne, lechuga, tomate y queso",
    ingredients: ["Carne", "Lechuga", "Tomate", "Queso", "Pan", "Salsa"]
  },
  {
    id: 2,
    name: "Hamburguesa Doble",
    category: "hamburguesas",
    price: 12300,
    image: "/hamburguesas/hamburguesa-doble.jpg",
    description: "Doble carne con queso cheddar",
    ingredients: [
      "Doble Carne",
      "Queso Cheddar",
      "Cebolla",
      "Pepinillos",
      "Pan",
      "Salsa especial"
    ]
  },
  {
    id: 3,
    name: "Hamburguesa Triple",
    category: "hamburguesas",
    price: 20999,
    image: "/hamburguesas/hamburguesa-triple.jpg",
    description: "Triple carne con queso cheddar",
    ingredients: [
      "Triple Carne",
      "Queso Cheddar",
      "Cebolla",
      "Pepinillos",
      "Pan",
      "Salsa especial"
    ]
  },
  {
    id: 3,
    name: "Pizza Clásica",
    category: "pizzas",
    price: 15000,
    image: "/pizzas/pizza-clasica.jpg",
    description: "Pizza clásica con tomate y mozzarella",
    ingredients: [
      "Salsa de tomate",
      "Mozzarella",
      "Albahaca",
      "Aceite de oliva"
    ]
  },
  {
    id: 4,
    name: "Pizza Calabreza",
    category: "pizzas",
    price: 16000,
    image: "/pizzas/pizza-calabreza.jpg",
    description: "Pizza con salame y queso",
    ingredients: ["Salsa de tomate", "Mozzarella", "Pepperoni", "Orégano"]
  },
  {
    id: 5,
    name: "Lomo Clásico",
    category: "lomitos",
    price: 15000,
    image: "/lomitos/lomo-clasico.jpg",
    description: "Lomo, lechuga, tomate, mayo cacera, queso",
    ingredients: ["Lomo", "Pan", "Mayonesa", "Tomate", "Lechuga", "Queso"]
  },
  {
    id: 6,
    name: "Lomo Para Dos",
    category: "lomitos",
    price: 14000,
    image: "/lomitos/lomo-para-dos.jpg",
    description: "Lomo, lechuga, tomate, mayo cacera, queso",
    ingredients: ["Lomo", "Pan", "Mayonesa", "Tomate", "Lechuga", "Queso"]
  },
  {
    id: 7,
    name: "LomoPizza",
    category: "lomitos",
    price: 20000,
    image: "/lomitos/lomo-pizza.jpg",
    description: "Lomo, lechuga, tomate, mayo cacera, queso, salsa",
    ingredients: ["Lomo", "Pan", "Mayonesa", "Tomate", "Lechuga", "Queso", "Salsa"]
  },
  {
    id: 8,
    name: "Coca Cola",
    category: "bebidas",
    price: 1700,
    image: "/gaseosas/coca-cola.jpg",
    description: "Bebida refrescante 500ml",
    ingredients: []
  },
  {
    id: 9,
    name: "Sprite",
    category: "bebidas",
    price: 1500,
    image: "/gaseosas/sprite.jpg",
    description: "Bebida refrescante 500ml",
    ingredients: []
  },
  {
    id: 10,
    name: "Pepsi",
    category: "bebidas",
    price: 1600,
    image: "/gaseosas/pepsi.jpg",
    description: "Bebida refrescante 500ml",
    ingredients: []
  },
  {
    id: 11,
    name: "Sandwich De Bondiola",
    category: "sandwichs",
    price: 8000,
    image: "/sandwichs/sandwich-bondiola.jpeg",
    description: "Bondiola desmenuzada",
    ingredients: []
  },
  {
    id: 12,
    name: "Hamburguesa Vegana",
    category: "vegano",
    price: 10000,
    image: "/vegano/hamburguesa-vegana.jpg",
    description: "Hamburguesa Vegana",
    ingredients: []
  },
  {
    id: 13,
    name: "Lomo Vegano",
    category: "vegano",
    price: 13000,
    image: "/vegano/lomo-vegano.png",
    description: "Lomo Vegano",
    ingredients: []
  },
  {
    id: 14,
    name: "Chocotorta",
    category: "postre",
    price: 8000,
    image: "/postres/chocotorta.png",
    description: "Lomo Vegano",
    ingredients: []
  },
  {
    id: 14,
    name: "Postre Borracho",
    category: "postre",
    price: 8000,
    image: "/postres/postre-borracho.jpg",
    description: "Postre borracho",
    ingredients: []
  },
  {
    id: 15,
    name: "Ensalada de Frutas",
    category: "postre",
    price: 8000,
    image: "/postres/ensalada-de-fruta.jpg",
    description: "Ensalada de frutas",
    ingredients: []
  },
];

export const categories = [
  { id: "todos", name: "Todos" },
  { id: "hamburguesas", name: "Hamburguesas" },
  { id: "lomitos", name: "Lomitos" },
  { id: "sandwichs", name: "Sandwichs" },
  { id: "pizzas", name: "Pizzas" },
  { id: "vegano", name: "Vegano" },
  { id: "postre", name: "Postres" },
  { id: "bebidas", name: "Bebidas" }
];
