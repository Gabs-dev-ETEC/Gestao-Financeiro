from app import app, db, migrar_banco, Categoria, Saldo, CATEGORIAS_PADRAO, Usuario
from werkzeug.security import generate_password_hash

with app.app_context():
    db.create_all()
    migrar_banco()

    # Categorias padrão
    if Categoria.query.count() == 0:
        for cat in CATEGORIAS_PADRAO:
            db.session.add(Categoria(nome=cat["nome"], cor=cat["cor"]))

    # Saldo inicial
    if not Saldo.query.first():
        db.session.add(Saldo(valor=0))

    # Usuários
    usuarios = [
        {"username": "Bruna Emilly Viana Siqueira",        "password": "07663696174", "tipo": "admin"},
        {"username": "Patricia Pereira de Oliveira",        "password": "07626243102", "tipo": "admin"},
        {"username": "Mateus Santo Silva",                  "password": "05405469173", "tipo": "admin"},
        {"username": "Gabriellen Vitoria Nunes de Sousa",  "password": "03774249199", "tipo": "admin"},
    ]
    for u in usuarios:
        if not Usuario.query.filter_by(username=u["username"]).first():
            db.session.add(Usuario(
                username=u["username"],
                password_hash=generate_password_hash(u["password"]),
                tipo=u["tipo"]
            ))
            print(f"Usuário '{u['username']}' criado!")
        else:
            print(f"Usuário '{u['username']}' já existe, pulando.")

    db.session.commit()
    print("Banco atualizado com sucesso!")