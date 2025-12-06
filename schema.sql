--
-- PostgreSQL database dump
--

\restrict v6DmWrkUW6EpcPZrGAhi1TBI1hINTJP1Nvn2fPIvlMlpNb3T6USskLeUeJHzfci

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1 (Ubuntu 18.1-1.pgdg24.04+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chains; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chains (
    chain_id integer NOT NULL,
    chain_name character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.chains OWNER TO postgres;

--
-- Name: chains_chain_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chains_chain_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chains_chain_id_seq OWNER TO postgres;

--
-- Name: chains_chain_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chains_chain_id_seq OWNED BY public.chains.chain_id;


--
-- Name: product_map_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_map_links (
    link_id integer NOT NULL,
    store_id integer NOT NULL,
    product_id integer NOT NULL,
    map_element_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.product_map_links OWNER TO postgres;

--
-- Name: product_map_links_link_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_map_links_link_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_map_links_link_id_seq OWNER TO postgres;

--
-- Name: product_map_links_link_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_map_links_link_id_seq OWNED BY public.product_map_links.link_id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    product_id integer NOT NULL,
    chain_id integer,
    sku character varying(100) NOT NULL,
    product_name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    base_price numeric(10,2),
    image_url text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: products_product_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_product_id_seq OWNER TO postgres;

--
-- Name: products_product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_product_id_seq OWNED BY public.products.product_id;


--
-- Name: store_inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.store_inventory (
    inventory_id integer NOT NULL,
    store_id integer,
    product_id integer,
    aisle character varying(50),
    shelf_position character varying(50),
    stock_quantity integer DEFAULT 0,
    is_available boolean DEFAULT true,
    last_updated timestamp without time zone DEFAULT now()
);


ALTER TABLE public.store_inventory OWNER TO postgres;

--
-- Name: store_inventory_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.store_inventory_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.store_inventory_inventory_id_seq OWNER TO postgres;

--
-- Name: store_inventory_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.store_inventory_inventory_id_seq OWNED BY public.store_inventory.inventory_id;


--
-- Name: store_map_elements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.store_map_elements (
    id integer NOT NULL,
    store_id integer NOT NULL,
    element_type character varying(20) NOT NULL,
    name character varying(255),
    x numeric(10,2) NOT NULL,
    y numeric(10,2) NOT NULL,
    width numeric(10,2) NOT NULL,
    height numeric(10,2) NOT NULL,
    color character varying(20) DEFAULT '#3b82f6'::character varying,
    z_index integer DEFAULT 0,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.store_map_elements OWNER TO postgres;

--
-- Name: store_map_elements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.store_map_elements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.store_map_elements_id_seq OWNER TO postgres;

--
-- Name: store_map_elements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.store_map_elements_id_seq OWNED BY public.store_map_elements.id;


--
-- Name: store_maps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.store_maps (
    map_id integer NOT NULL,
    store_id integer,
    map_image_url text,
    map_data jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.store_maps OWNER TO postgres;

--
-- Name: store_maps_map_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.store_maps_map_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.store_maps_map_id_seq OWNER TO postgres;

--
-- Name: store_maps_map_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.store_maps_map_id_seq OWNED BY public.store_maps.map_id;


--
-- Name: stores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stores (
    store_id integer NOT NULL,
    chain_id integer,
    store_name character varying(255) NOT NULL,
    address text,
    city character varying(100),
    state character varying(50),
    zip character varying(20),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    map_image_url text
);


ALTER TABLE public.stores OWNER TO postgres;

--
-- Name: stores_store_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stores_store_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stores_store_id_seq OWNER TO postgres;

--
-- Name: stores_store_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stores_store_id_seq OWNED BY public.stores.store_id;


--
-- Name: chains chain_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chains ALTER COLUMN chain_id SET DEFAULT nextval('public.chains_chain_id_seq'::regclass);


--
-- Name: product_map_links link_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_map_links ALTER COLUMN link_id SET DEFAULT nextval('public.product_map_links_link_id_seq'::regclass);


--
-- Name: products product_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN product_id SET DEFAULT nextval('public.products_product_id_seq'::regclass);


--
-- Name: store_inventory inventory_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_inventory ALTER COLUMN inventory_id SET DEFAULT nextval('public.store_inventory_inventory_id_seq'::regclass);


--
-- Name: store_map_elements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_map_elements ALTER COLUMN id SET DEFAULT nextval('public.store_map_elements_id_seq'::regclass);


--
-- Name: store_maps map_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_maps ALTER COLUMN map_id SET DEFAULT nextval('public.store_maps_map_id_seq'::regclass);


--
-- Name: stores store_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores ALTER COLUMN store_id SET DEFAULT nextval('public.stores_store_id_seq'::regclass);


--
-- Name: chains chains_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chains
    ADD CONSTRAINT chains_pkey PRIMARY KEY (chain_id);


--
-- Name: product_map_links product_map_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_map_links
    ADD CONSTRAINT product_map_links_pkey PRIMARY KEY (link_id);


--
-- Name: product_map_links product_map_links_store_id_product_id_map_element_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_map_links
    ADD CONSTRAINT product_map_links_store_id_product_id_map_element_id_key UNIQUE (store_id, product_id, map_element_id);


--
-- Name: products products_chain_id_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_chain_id_sku_key UNIQUE (chain_id, sku);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (product_id);


--
-- Name: store_inventory store_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_inventory
    ADD CONSTRAINT store_inventory_pkey PRIMARY KEY (inventory_id);


--
-- Name: store_inventory store_inventory_store_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_inventory
    ADD CONSTRAINT store_inventory_store_id_product_id_key UNIQUE (store_id, product_id);


--
-- Name: store_map_elements store_map_elements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_map_elements
    ADD CONSTRAINT store_map_elements_pkey PRIMARY KEY (id);


--
-- Name: store_maps store_maps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_maps
    ADD CONSTRAINT store_maps_pkey PRIMARY KEY (map_id);


--
-- Name: store_maps store_maps_store_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_maps
    ADD CONSTRAINT store_maps_store_id_key UNIQUE (store_id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (store_id);


--
-- Name: idx_product_map_links_element; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_map_links_element ON public.product_map_links USING btree (map_element_id);


--
-- Name: idx_product_map_links_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_map_links_product ON public.product_map_links USING btree (product_id);


--
-- Name: idx_product_map_links_store; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_map_links_store ON public.product_map_links USING btree (store_id);


--
-- Name: idx_products_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_name ON public.products USING gin (to_tsvector('english'::regconfig, (product_name)::text));


--
-- Name: idx_products_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_sku ON public.products USING btree (sku);


--
-- Name: idx_store_inventory_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_store_inventory_product ON public.store_inventory USING btree (product_id);


--
-- Name: idx_store_inventory_store; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_store_inventory_store ON public.store_inventory USING btree (store_id);


--
-- Name: idx_store_map_elements_store_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_store_map_elements_store_id ON public.store_map_elements USING btree (store_id);


--
-- Name: product_map_links product_map_links_map_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_map_links
    ADD CONSTRAINT product_map_links_map_element_id_fkey FOREIGN KEY (map_element_id) REFERENCES public.store_map_elements(id) ON DELETE CASCADE;


--
-- Name: product_map_links product_map_links_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_map_links
    ADD CONSTRAINT product_map_links_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id) ON DELETE CASCADE;


--
-- Name: product_map_links product_map_links_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_map_links
    ADD CONSTRAINT product_map_links_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: products products_chain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_chain_id_fkey FOREIGN KEY (chain_id) REFERENCES public.chains(chain_id);


--
-- Name: store_inventory store_inventory_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_inventory
    ADD CONSTRAINT store_inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- Name: store_inventory store_inventory_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_inventory
    ADD CONSTRAINT store_inventory_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id);


--
-- Name: store_map_elements store_map_elements_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_map_elements
    ADD CONSTRAINT store_map_elements_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id) ON DELETE CASCADE;


--
-- Name: store_maps store_maps_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_maps
    ADD CONSTRAINT store_maps_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id);


--
-- Name: stores stores_chain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_chain_id_fkey FOREIGN KEY (chain_id) REFERENCES public.chains(chain_id);


--
-- PostgreSQL database dump complete
--

\unrestrict v6DmWrkUW6EpcPZrGAhi1TBI1hINTJP1Nvn2fPIvlMlpNb3T6USskLeUeJHzfci

